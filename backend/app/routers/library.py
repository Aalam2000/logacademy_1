"""
Единая лента «Базы знаний» — файлы + квизы + ссылки одним списком, с
фильтром по типу/загрузчику и сортировкой по дате/названию.

Читает-только (сама привязка/отвязка/загрузка — в materials.py,
quizzes.py, links.py, routers/lessons.py). Три таблицы разной формы —
своя колонка на каждую — поэтому объединяем в Python, а не SQL UNION:
здесь это проще и понятнее, чем городить приведение типов колонок
в сыром запросе.
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import require_teacher
from ..models import Link, Material, Quiz, User
from ..resources import count_attachments_map

router = APIRouter(prefix="/library", tags=["library"])


class LibraryItemOut(BaseModel):
    resource_type: str  # material | quiz | link
    id: int
    title: str
    content_type: Optional[str] = None   # material
    size_bytes: Optional[int] = None     # material
    template_type: Optional[str] = None  # quiz
    topic: Optional[str] = None          # quiz
    url: Optional[str] = None            # link
    uploaded_by: int
    uploaded_by_name: Optional[str] = None
    created_at: datetime
    attached_lessons_count: int = 0
    # Теги шаблона курса (см. claude/course-templates-plan.md) — сейчас
    # есть только у материалов, и видны только admin (проверка/утверждение
    # шаблонов — admin-функция); у quiz/link всегда None.
    course_id: Optional[int] = None
    sector: Optional[str] = None
    template_lesson_no: Optional[str] = None
    template_status: Optional[str] = None


# "Шаблонный" ресурс — course_id+sector+template_lesson_no заполнены все
# разом (см. claude/course-templates-plan.md). Такие файлы по умолчанию
# скрыты из общей ленты БЗ — они готовятся/утверждаются под конкретный
# курс и просто мешают в обычной работе (решение Андрея); include_templates
# их возвращает, когда они реально нужны (например, при проверке в admin).
def _is_template_row(course_id, sector, template_lesson_no) -> bool:
    return bool(course_id and sector and template_lesson_no)


async def _list_materials(db: AsyncSession, current_user: User, include_templates: bool) -> list[LibraryItemOut]:
    rows = await db.execute(
        select(Material, User.full_name, User.username)
        .join(User, User.id == Material.uploaded_by)
    )
    is_admin = current_user.role == "admin"
    items = []
    for material, full_name, username in rows.all():
        if not include_templates and _is_template_row(material.course_id, material.sector, material.template_lesson_no):
            continue
        items.append(LibraryItemOut(
            resource_type="material",
            id=material.id,
            title=material.original_filename,
            content_type=material.content_type,
            size_bytes=material.size_bytes,
            uploaded_by=material.uploaded_by,
            uploaded_by_name=full_name or username,
            created_at=material.created_at,
            course_id=material.course_id if is_admin else None,
            sector=material.sector if is_admin else None,
            template_lesson_no=material.template_lesson_no if is_admin else None,
            template_status=material.template_status if is_admin else None,
        ))
    return items


async def _list_quizzes(db: AsyncSession, current_user: User, include_templates: bool) -> list[LibraryItemOut]:
    rows = await db.execute(
        select(Quiz, User.full_name, User.username)
        .join(User, User.id == Quiz.created_by)
    )
    items = []
    for quiz, full_name, username in rows.all():
        if not include_templates and _is_template_row(quiz.course_id, quiz.sector, quiz.template_lesson_no):
            continue
        items.append(LibraryItemOut(
            resource_type="quiz",
            id=quiz.id,
            title=quiz.title,
            template_type=quiz.template_type,
            topic=quiz.topic,
            uploaded_by=quiz.created_by,
            uploaded_by_name=full_name or username,
            created_at=quiz.created_at,
        ))
    return items


async def _list_links(db: AsyncSession, current_user: User, include_templates: bool) -> list[LibraryItemOut]:
    rows = await db.execute(
        select(Link, User.full_name, User.username)
        .join(User, User.id == Link.added_by)
    )
    items = []
    for link, full_name, username in rows.all():
        if not include_templates and _is_template_row(link.course_id, link.sector, link.template_lesson_no):
            continue
        items.append(LibraryItemOut(
            resource_type="link",
            id=link.id,
            title=link.title,
            url=link.url,
            uploaded_by=link.added_by,
            uploaded_by_name=full_name or username,
            created_at=link.created_at,
        ))
    return items


LISTERS = {
    "material": _list_materials,
    "quiz": _list_quizzes,
    "link": _list_links,
}


# База знаний — доступна teacher и admin (как и раньше у materials.py)
@router.get("/items", response_model=list[LibraryItemOut])
async def list_library_items(
    type: Optional[str] = Query(default=None, description="material | quiz | link"),
    uploader: Optional[int] = Query(default=None),
    course_id: Optional[int] = Query(default=None, description="Только admin — фильтр по шаблону курса"),
    sector: Optional[str] = Query(default=None, description="Только admin — фильтр по шаблону курса ('ru' | 'az')"),
    include_templates: bool = Query(default=False, description="Показывать материалы, привязанные к шаблонам уроков курса (по умолчанию скрыты — мешают в обычной работе с БЗ)"),
    sort: str = Query(default="date", description="date | title"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    types_to_load = [type] if type in LISTERS else LISTERS.keys()

    # Фильтр по курсу/сектору имеет смысл только вместе с шаблонными
    # файлами — если он задан, показываем их независимо от include_templates.
    show_templates = include_templates or course_id is not None or bool(sector)

    items: list[LibraryItemOut] = []
    for resource_type in types_to_load:
        items.extend(await LISTERS[resource_type](db, current_user, show_templates))

    if uploader is not None:
        items = [item for item in items if item.uploaded_by == uploader]

    # course_id/sector заполнены только у материалов и только для admin
    # (см. _list_materials) — у остальных items они всегда None, поэтому
    # для не-admin и для quiz/link фильтр просто не даст ни одного совпадения.
    if course_id is not None:
        items = [item for item in items if item.course_id == course_id]
    if sector:
        items = [item for item in items if item.sector == sector]

    counts = await count_attachments_map(db)
    for item in items:
        item.attached_lessons_count = counts.get((item.resource_type, item.id), 0)

    if sort == "title":
        items.sort(key=lambda item: item.title.lower())
    else:
        items.sort(key=lambda item: item.created_at, reverse=True)

    return items
