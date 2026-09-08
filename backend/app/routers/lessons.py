from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from datetime import datetime
from typing import Optional
from pydantic import BaseModel
from ..database import get_db
from ..models import Lesson, Group, GroupMember, User
from ..dependencies import require_teacher, get_current_user

router = APIRouter(prefix="/lessons", tags=["lessons"])


# Схемы прямо здесь — потом перенесём в schemas.py
class LessonCreate(BaseModel):
    group_id: int
    title: str
    order: int = 0
    date: Optional[datetime] = None
    source: Optional[str] = "teacher"  # academy | teacher

class LessonUpdate(BaseModel):
    title: Optional[str] = None
    order: Optional[int] = None
    date: Optional[datetime] = None

class LessonOut(BaseModel):
    id: int
    group_id: int
    title: str
    order: int
    date: Optional[datetime]
    is_open: bool
    source: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


# Уроки группы
@router.get("/group/{group_id}", response_model=list[LessonOut])
async def get_group_lessons(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    # Проверяем доступ к группе
    group = await db.execute(
        select(Group).where(Group.id == group_id, Group.teacher_id == current_user.id)
    )
    if not group.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Нет доступа к этой группе")

    result = await db.execute(
        select(Lesson).where(Lesson.group_id == group_id).order_by(Lesson.order)
    )
    return result.scalars().all()


# Создать урок
@router.post("/", response_model=LessonOut)
async def create_lesson(
    data: LessonCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    group = await db.execute(
        select(Group).where(Group.id == data.group_id, Group.teacher_id == current_user.id)
    )
    if not group.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Нет доступа к этой группе")

    lesson = Lesson(
        group_id=data.group_id,
        title=data.title,
        order=data.order,
        date=data.date,
        source=data.source,
        is_open=False
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


# Открыть / закрыть доступ к уроку
@router.patch("/{lesson_id}/open")
async def toggle_lesson_open(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    # Проверяем доступ через группу
    group = await db.execute(
        select(Group).where(Group.id == lesson.group_id, Group.teacher_id == current_user.id)
    )
    if not group.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Нет доступа")

    lesson.is_open = not lesson.is_open
    await db.commit()
    return {"is_open": lesson.is_open}


# Копировать урок в другую группу
@router.post("/{lesson_id}/copy")
async def copy_lesson(
    lesson_id: int,
    target_group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    # Проверяем доступ к целевой группе
    group = await db.execute(
        select(Group).where(Group.id == target_group_id, Group.teacher_id == current_user.id)
    )
    if not group.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Нет доступа к целевой группе")

    new_lesson = Lesson(
        group_id=target_group_id,
        title=lesson.title,
        order=lesson.order,
        date=None,  # дату копируем пустой — педагог назначит
        source=lesson.source,
        is_open=False
    )
    db.add(new_lesson)
    await db.commit()
    await db.refresh(new_lesson)
    return new_lesson

# Все уроки педагога (для главной страницы)
@router.get("/my", response_model=list[LessonOut])
async def get_my_lessons(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    # Находим все группы педагога
    groups_result = await db.execute(
        select(Group).where(Group.teacher_id == current_user.id)
    )
    group_ids = [g.id for g in groups_result.scalars().all()]
    if not group_ids:
        return []
    result = await db.execute(
        select(Lesson)
        .where(Lesson.group_id.in_(group_ids))
        .order_by(Lesson.date)
    )
    return result.scalars().all()


# Уроки студента — только открытые
@router.get("/student", response_model=list[LessonOut])
async def get_student_lessons(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Находим группы студента
    members_result = await db.execute(
        select(GroupMember).where(
            GroupMember.student_id == current_user.id,
            GroupMember.status == "active"
        )
    )
    group_ids = [m.group_id for m in members_result.scalars().all()]
    if not group_ids:
        return []
    result = await db.execute(
        select(Lesson)
        .where(Lesson.group_id.in_(group_ids), Lesson.is_open == True)
        .order_by(Lesson.date)
    )
    return result.scalars().all()