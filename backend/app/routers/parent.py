"""Доступ родителя по личной ссылке /p/<токен> — без логина и пароля, только чтение.

Ссылка принадлежит телефону родителя (users.parent_phone, нормализован app/phones.py):
по ней видны все дети, у которых в карточке этот телефон и есть активная группа —
у страницы родителя вкладки с именами детей. Что видно: «Успеваемость» ребёнка
(оценки, посещаемость, ДЗ) и по клику на урок — задания ДЗ, ответ и диалог урока.
Данные отдаются теми же функциями, что студенту (routers/lessons.py, homework.py):
запрос выполняется «от имени» ребёнка, поэтому и правила видимости те же самые
(только открытые уроки его активных групп, персональные — только свои).

Создаёт и меняет ссылку педагог (ученику своих групп) или админ — в карточке
ученика. «Новая ссылка» отключает старую (revoked_at). Токен — 8 знаков
латиницы и цифр; ограничения попыток подбора нет (nginx не передаёт настоящий IP),
защита — длина токена.
"""
import re
import secrets
import string
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import storage
from ..database import get_db
from ..dependencies import require_teacher
from ..homework_status import task_is_for
from ..models import GroupMember, HomeworkTask, Material, ParentLink, User
from . import homework, lessons, materials
from .students import _get_accessible_student

router = APIRouter(tags=["parent"])

TOKEN_LEN = 8
TOKEN_CHARS = string.ascii_letters + string.digits
TOKEN_RE = re.compile(rf"^[A-Za-z0-9]{{{TOKEN_LEN}}}$")
INVALID = "Ссылка недействительна. Попросите педагога прислать новую."


def _now() -> datetime:
    return datetime.now(timezone.utc)


async def _active_link(db: AsyncSession, phone: Optional[str]) -> Optional[ParentLink]:
    if not phone:
        return None
    return (await db.execute(
        select(ParentLink).where(ParentLink.parent_phone == phone, ParentLink.revoked_at.is_(None))
        .order_by(ParentLink.id.desc()).limit(1)
    )).scalar_one_or_none()


async def _children(db: AsyncSession, phone: str) -> list[User]:
    """Дети родителя: студенты с этим телефоном родителя и хотя бы одной активной группой."""
    active = select(GroupMember.student_id).where(GroupMember.status == "active")
    rows = (await db.execute(
        select(User).where(User.role == "student", User.parent_phone == phone, User.id.in_(active))
    )).scalars().all()
    return sorted(rows, key=lambda u: (u.full_name or u.username).lower())


def _name(u: User) -> str:
    return u.full_name or u.username


async def _new_token(db: AsyncSession) -> str:
    while True:
        token = "".join(secrets.choice(TOKEN_CHARS) for _ in range(TOKEN_LEN))
        if not (await db.execute(select(ParentLink.id).where(ParentLink.token == token))).first():
            return token


# ---------- Педагог / админ: ссылка в карточке ученика ----------

class ParentLinkOut(BaseModel):
    parent_name: Optional[str] = None
    parent_phone: Optional[str] = None
    token: Optional[str] = None           # нет — ссылку ещё не создавали (или нет телефона родителя)
    children: list[str] = []              # кого родитель увидит по ссылке
    last_used_at: Optional[datetime] = None


class ParentLinkIn(BaseModel):
    renew: bool = False                   # True — отключить старую ссылку и выдать новую


async def _link_out(db: AsyncSession, student: User) -> ParentLinkOut:
    link = await _active_link(db, student.parent_phone)
    children = [_name(u) for u in await _children(db, student.parent_phone)] if student.parent_phone else []
    return ParentLinkOut(
        parent_name=student.parent_name, parent_phone=student.parent_phone,
        token=link.token if link else None, children=children,
        last_used_at=link.last_used_at if link else None,
    )


@router.get("/parent-links/student/{student_id}", response_model=ParentLinkOut)
async def get_parent_link(
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    student, _, _ = await _get_accessible_student(db, student_id, current_user)
    return await _link_out(db, student)


@router.post("/parent-links/student/{student_id}", response_model=ParentLinkOut)
async def make_parent_link(
    student_id: int,
    data: ParentLinkIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    student, _, _ = await _get_accessible_student(db, student_id, current_user)
    if not student.parent_phone:
        raise HTTPException(status_code=422, detail="Сначала заполните и сохраните телефон родителя")
    link = await _active_link(db, student.parent_phone)
    if link and data.renew:
        link.revoked_at = _now()
        link = None
    if link is None:
        db.add(ParentLink(parent_phone=student.parent_phone, token=await _new_token(db), created_by=current_user.id))
    await db.commit()
    return await _link_out(db, student)


# ---------- Родитель: всё только для чтения ----------

async def _link_by_token(db: AsyncSession, token: str) -> ParentLink:
    link = None
    if TOKEN_RE.match(token or ""):
        link = (await db.execute(
            select(ParentLink).where(ParentLink.token == token, ParentLink.revoked_at.is_(None))
        )).scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail=INVALID)
    return link


async def _child(db: AsyncSession, token: str, student_id: int) -> User:
    link = await _link_by_token(db, token)
    for u in await _children(db, link.parent_phone):
        if u.id == student_id:
            return u
    raise HTTPException(status_code=404, detail="Нет доступа к этому ученику")


class ParentChildOut(BaseModel):
    id: int
    name: str
    groups: list[str] = []


class ParentHomeOut(BaseModel):
    parent_name: Optional[str] = None
    children: list[ParentChildOut]


@router.get("/parent/{token}", response_model=ParentHomeOut)
async def parent_home(token: str, db: AsyncSession = Depends(get_db)):
    from ..models import Group
    link = await _link_by_token(db, token)
    kids = await _children(db, link.parent_phone)
    groups: dict[int, list[str]] = {}
    if kids:
        for sid, gname in (await db.execute(
            select(GroupMember.student_id, Group.name).join(Group, Group.id == GroupMember.group_id)
            .where(GroupMember.student_id.in_([k.id for k in kids]), GroupMember.status == "active")
            .order_by(Group.name)
        )).all():
            groups.setdefault(sid, []).append(gname)
    link.last_used_at = _now()
    await db.commit()
    parent_name = next((k.parent_name for k in kids if k.parent_name), None)
    return ParentHomeOut(
        parent_name=parent_name,
        children=[ParentChildOut(id=k.id, name=_name(k), groups=groups.get(k.id, [])) for k in kids],
    )


@router.get("/parent/{token}/children/{student_id}/marks", response_model=list[lessons.MyPerformanceRowOut])
async def parent_marks(token: str, student_id: int, db: AsyncSession = Depends(get_db)):
    child = await _child(db, token, student_id)
    return await lessons.get_student_marks(db=db, current_user=child)


@router.get("/parent/{token}/children/{student_id}/grades", response_model=lessons.MyGradesOut)
async def parent_grades(token: str, student_id: int, db: AsyncSession = Depends(get_db)):
    child = await _child(db, token, student_id)
    return await lessons.get_student_grades(db=db, current_user=child)


@router.get("/parent/{token}/children/{student_id}/lessons/{lesson_id}/homework", response_model=homework.MyHomeworkOut)
async def parent_homework(token: str, student_id: int, lesson_id: int, db: AsyncSession = Depends(get_db)):
    child = await _child(db, token, student_id)
    return await homework.get_my_homework(lesson_id=lesson_id, db=db, current_user=child)


class ParentMessageOut(BaseModel):
    id: int
    author_name: str
    from_teacher: bool
    text: str
    created_at: Optional[datetime] = None
    edited_at: Optional[datetime] = None


@router.get("/parent/{token}/children/{student_id}/lessons/{lesson_id}/messages", response_model=list[ParentMessageOut])
async def parent_messages(token: str, student_id: int, lesson_id: int, db: AsyncSession = Depends(get_db)):
    child = await _child(db, token, student_id)
    thread = await homework.get_messages(lesson_id=lesson_id, student_id=child.id, db=db, current_user=child)
    return [ParentMessageOut(id=m.id, author_name=m.author_name, from_teacher=m.from_teacher, text=m.text,
                             created_at=m.created_at, edited_at=m.edited_at) for m in thread]


@router.get("/parent/{token}/children/{student_id}/lessons/{lesson_id}/tasks/{task_id}/file")
async def parent_task_file(token: str, student_id: int, lesson_id: int, task_id: int, db: AsyncSession = Depends(get_db)):
    """Файл задания — открыть на телефоне: docx/xlsx/pptx — как PDF, картинки и PDF — как есть."""
    child = await _child(db, token, student_id)
    await lessons.get_lesson_for_student(lesson_id, db, child)
    task = (await db.execute(select(HomeworkTask).where(
        HomeworkTask.id == task_id, HomeworkTask.lesson_id == lesson_id,
    ))).scalar_one_or_none()
    if not task or not task_is_for(task, child.id):
        raise HTTPException(status_code=404, detail="Задание не найдено")
    material = (await db.execute(select(Material).where(Material.id == task.material_id))).scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Файл не найден")
    ext = Path(material.original_filename).suffix.lower()
    if ext in materials.PREVIEW_CONVERTIBLE_EXTENSIONS:
        pdf = await materials._get_preview_pdf(material.object_key, ext)
        return Response(content=pdf, media_type="application/pdf")
    media_type = material.content_type or "application/octet-stream"
    disposition = "inline" if (media_type == "application/pdf" or (media_type.startswith("image/") and media_type != "image/svg+xml")) else "attachment"
    return StreamingResponse(
        storage.stream_object(material.object_key), media_type=media_type,
        headers={"Content-Disposition": materials._content_disposition(material.original_filename, disposition)},
    )


@router.get("/parent/{token}/children/{student_id}/lessons/{lesson_id}/answer-files/{file_id}")
async def parent_answer_file(token: str, student_id: int, lesson_id: int, file_id: int, db: AsyncSession = Depends(get_db)):
    child = await _child(db, token, student_id)
    return await homework.download_answer_file(lesson_id=lesson_id, file_id=file_id, inline=True, db=db, current_user=child)
