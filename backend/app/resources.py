"""
Общая логика вокруг полиморфного ресурса урока (файл/квиз/ссылка) —
переиспользуется в routers/materials.py, routers/quizzes.py,
routers/links.py (запрет удаления, если объект где-то привязан к уроку)
и в routers/lessons.py (привязка/отвязка к уроку).

Не роутер — просто общие функции, чтобы не дублировать одну и ту же
проверку в трёх местах.
"""
from typing import Optional

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import Link, LessonResource, Material, Quiz, User

RESOURCE_MODELS = {
    "material": Material,
    "quiz": Quiz,
    "link": Link,
}

RESOURCE_LABELS = {
    "material": "Файл",
    "quiz": "Квиз",
    "link": "Ссылка",
}

RESOURCE_NOT_FOUND = {
    "material": "Файл не найден",
    "quiz": "Квиз не найден",
    "link": "Ссылка не найдена",
}


def _lessons_phrase(n: int) -> str:
    # "к 1 уроку", "к 2 урокам", "к 11 урокам", "к 21 уроку"
    if n % 10 == 1 and n % 100 != 11:
        return f"{n} уроку"
    return f"{n} урокам"


async def resource_exists(db: AsyncSession, resource_type: str, resource_id: int) -> bool:
    model = RESOURCE_MODELS[resource_type]
    result = await db.execute(select(model.id).where(model.id == resource_id))
    return result.scalar_one_or_none() is not None


async def count_lesson_attachments(db: AsyncSession, resource_type: str, resource_id: int) -> int:
    result = await db.execute(
        select(func.count()).select_from(LessonResource).where(
            LessonResource.resource_type == resource_type,
            LessonResource.resource_id == resource_id,
        )
    )
    return result.scalar_one()


async def count_attachments_map(db: AsyncSession) -> dict[tuple[str, int], int]:
    # Одним запросом — счётчики привязок сразу для всех ресурсов
    # (используется в library.py, чтобы не гонять запрос на каждую строку).
    result = await db.execute(
        select(
            LessonResource.resource_type,
            LessonResource.resource_id,
            func.count(),
        ).group_by(LessonResource.resource_type, LessonResource.resource_id)
    )
    return {(resource_type, resource_id): cnt for resource_type, resource_id, cnt in result.all()}


async def ensure_deletable(db: AsyncSession, resource_type: str, resource_id: int) -> None:
    # Удалять из библиотеки можно только то, что нигде не привязано —
    # см. claude/lesson-resources-plan.md.
    count = await count_lesson_attachments(db, resource_type, resource_id)
    if count:
        label = RESOURCE_LABELS[resource_type]
        raise HTTPException(
            status_code=409,
            detail=f"{label} привязан к {_lessons_phrase(count)} — сначала отвяжите от урока(ов)",
        )


# Единая форма "деталей ресурса" вне зависимости от таблицы-источника —
# используется и в library.py (вся лента), и в lessons.py (только
# привязанное к уроку, через ids=...). owner_id/owner_name/owner_created_at —
# это "кто загрузил/создал и когда" (не путать с added_by/added_at
# привязки к уроку — это про другое действие и считается отдельно, в
# lessons.py, из LessonResource).
async def fetch_resource_details(
    db: AsyncSession,
    resource_type: str,
    ids: Optional[set[int]] = None,
) -> list[dict]:
    if resource_type == "material":
        query = select(Material, User.full_name, User.username).join(User, User.id == Material.uploaded_by)
        if ids is not None:
            query = query.where(Material.id.in_(ids))
        rows = await db.execute(query)
        return [
            {
                "resource_type": "material",
                "id": m.id,
                "title": m.original_filename,
                "content_type": m.content_type,
                "size_bytes": m.size_bytes,
                "template_type": None,
                "topic": None,
                "url": None,
                "owner_id": m.uploaded_by,
                "owner_name": full_name or username,
                "owner_created_at": m.created_at,
            }
            for m, full_name, username in rows.all()
        ]

    if resource_type == "quiz":
        query = select(Quiz, User.full_name, User.username).join(User, User.id == Quiz.created_by)
        if ids is not None:
            query = query.where(Quiz.id.in_(ids))
        rows = await db.execute(query)
        return [
            {
                "resource_type": "quiz",
                "id": q.id,
                "title": q.title,
                "content_type": None,
                "size_bytes": None,
                "template_type": q.template_type,
                "topic": q.topic,
                "url": None,
                "owner_id": q.created_by,
                "owner_name": full_name or username,
                "owner_created_at": q.created_at,
            }
            for q, full_name, username in rows.all()
        ]

    # link
    query = select(Link, User.full_name, User.username).join(User, User.id == Link.added_by)
    if ids is not None:
        query = query.where(Link.id.in_(ids))
    rows = await db.execute(query)
    return [
        {
            "resource_type": "link",
            "id": l.id,
            "title": l.title,
            "content_type": None,
            "size_bytes": None,
            "template_type": None,
            "topic": None,
            "url": l.url,
            "owner_id": l.added_by,
            "owner_name": full_name or username,
            "owner_created_at": l.created_at,
        }
        for l, full_name, username in rows.all()
    ]
