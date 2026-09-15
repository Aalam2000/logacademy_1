from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import aliased
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo
from typing import Optional
from pydantic import BaseModel, Field
from ..database import get_db
from ..models import Lesson, Group, GroupMember, User, LessonMark, Material, LessonMaterial, Quiz
from ..dependencies import require_teacher, get_current_user

router = APIRouter(prefix="/lessons", tags=["lessons"])

BAKU_TZ = ZoneInfo("Asia/Baku")
ALLOWED_ATTENDANCE_STATUSES = {"in_person", "online", "excused", "absent"}


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


class LessonMarkIn(BaseModel):
    attendance_status: Optional[str] = None  # in_person | online | excused | absent | None
    is_late: bool = False
    score: Optional[int] = Field(default=None, ge=0, le=100)
    stars: Optional[int] = Field(default=None, ge=0, le=3)
    comment: Optional[str] = None


class LessonMarkBulkItem(LessonMarkIn):
    student_id: int


class LessonMarkOut(BaseModel):
    student_id: int
    full_name: Optional[str]
    attendance_status: Optional[str]
    is_late: bool
    score: Optional[int]
    stars: Optional[int]
    comment: Optional[str]
    marked_at: Optional[datetime]


class LessonMaterialOut(BaseModel):
    material_id: int
    original_filename: str
    content_type: Optional[str]
    size_bytes: int
    added_by_name: Optional[str]
    added_at: Optional[datetime]


class LessonQuizOut(BaseModel):
    id: int
    title: str
    topic: Optional[str]
    template_type: str
    created_at: datetime

    class Config:
        from_attributes = True


def is_lesson_locked(lesson: Lesson) -> bool:
    # Блокировка — в полночь дня урока по Баку. Если дата урока не задана —
    # блокировать нечего.
    if lesson.date is None:
        return False
    now_baku = datetime.now(BAKU_TZ)
    lesson_day_baku = lesson.date.astimezone(BAKU_TZ).date()
    return now_baku.date() > lesson_day_baku


def validate_attendance_status(value: Optional[str]) -> None:
    if value is not None and value not in ALLOWED_ATTENDANCE_STATUSES:
        raise HTTPException(status_code=422, detail=f"Недопустимый статус посещаемости: {value}")


async def get_lesson_for_teacher_or_admin(
    lesson_id: int,
    db: AsyncSession,
    current_user: User
):
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    group_query = select(Group).where(Group.id == lesson.group_id)
    if current_user.role != "admin":
        group_query = group_query.where(Group.teacher_id == current_user.id)

    group = await db.execute(group_query)
    if not group.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Нет доступа")

    return lesson


# Уроки группы
@router.get("/group/{group_id}", response_model=list[LessonOut])
async def get_group_lessons(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    # Для admin доступ к любой группе, для teacher — только к своей
    group_query = select(Group).where(Group.id == group_id)
    if current_user.role != "admin":
        group_query = group_query.where(Group.teacher_id == current_user.id)

    group = await db.execute(group_query)
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
    group_query = select(Group).where(Group.id == data.group_id)
    if current_user.role != "admin":
        group_query = group_query.where(Group.teacher_id == current_user.id)

    group = await db.execute(group_query)
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


# Все уроки педагога (для главной страницы)
@router.get("/my", response_model=list[LessonOut])
async def get_my_lessons(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
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
# ВАЖНО: должен идти раньше маршрутов с /{lesson_id} ниже — иначе FastAPI
# сопоставляет "/lessons/student" с /{lesson_id} (lesson_id="student"),
# который требует роль teacher/admin, и студент получает 403.
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


# Открыть / закрыть доступ к уроку
@router.patch("/{lesson_id}/open")
async def toggle_lesson_open(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    lesson = await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    lesson.is_open = not lesson.is_open
    await db.commit()
    return {"is_open": lesson.is_open}


async def _get_active_group_student_ids(lesson: Lesson, db: AsyncSession) -> set[int]:
    members = await db.execute(
        select(GroupMember.student_id).where(
            GroupMember.group_id == lesson.group_id,
            GroupMember.status == "active",
        )
    )
    return {row[0] for row in members.all()}


async def _upsert_mark(
    db: AsyncSession,
    lesson_id: int,
    student_id: int,
    data: LessonMarkIn,
    current_user: User,
) -> LessonMark:
    validate_attendance_status(data.attendance_status)

    result = await db.execute(
        select(LessonMark).where(
            LessonMark.lesson_id == lesson_id,
            LessonMark.student_id == student_id,
        )
    )
    mark = result.scalar_one_or_none()
    if not mark:
        mark = LessonMark(lesson_id=lesson_id, student_id=student_id)
        db.add(mark)

    mark.attendance_status = data.attendance_status
    mark.is_late = data.is_late
    mark.score = data.score
    mark.stars = data.stars
    mark.comment = data.comment
    mark.marked_by = current_user.id
    mark.marked_at = datetime.now(dt_timezone.utc)
    return mark


# Табличка урока: посещаемость/оценка/звёзды по всем студентам группы
# (включая тех, у кого ещё нет ни одной записи — пустые поля).
@router.get("/{lesson_id}/marks")
async def get_lesson_marks(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    lesson = await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    rows = await db.execute(
        select(User, LessonMark)
        .join(GroupMember, GroupMember.student_id == User.id)
        .outerjoin(
            LessonMark,
            (LessonMark.lesson_id == lesson_id) & (LessonMark.student_id == User.id),
        )
        .where(GroupMember.group_id == lesson.group_id, GroupMember.status == "active")
        .order_by(User.full_name)
    )

    students = []
    for user, mark in rows.all():
        students.append(LessonMarkOut(
            student_id=user.id,
            full_name=user.full_name or user.username,
            attendance_status=mark.attendance_status if mark else None,
            is_late=mark.is_late if mark else False,
            score=mark.score if mark else None,
            stars=mark.stars if mark else None,
            comment=mark.comment if mark else None,
            marked_at=mark.marked_at if mark else None,
        ))

    return {"locked": is_lesson_locked(lesson), "students": students}


# Сохранить отметку одного студента (автосохранение по полю на фронте)
@router.put("/{lesson_id}/marks/{student_id}")
async def save_lesson_mark(
    lesson_id: int,
    student_id: int,
    data: LessonMarkIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    lesson = await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)
    if is_lesson_locked(lesson):
        raise HTTPException(status_code=403, detail="Урок заблокирован для редактирования (прошла полночь по Баку)")

    active_ids = await _get_active_group_student_ids(lesson, db)
    if student_id not in active_ids:
        raise HTTPException(status_code=404, detail="Студент не найден в группе урока")

    mark = await _upsert_mark(db, lesson_id, student_id, data, current_user)
    await db.commit()
    await db.refresh(mark)
    return {"ok": True, "marked_at": mark.marked_at}


# Сохранить всю табличку разом («Сохранить» — подстраховка к автосохранению)
@router.put("/{lesson_id}/marks")
async def save_lesson_marks_bulk(
    lesson_id: int,
    data: list[LessonMarkBulkItem],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    lesson = await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)
    if is_lesson_locked(lesson):
        raise HTTPException(status_code=403, detail="Урок заблокирован для редактирования (прошла полночь по Баку)")

    active_ids = await _get_active_group_student_ids(lesson, db)
    unknown = [item.student_id for item in data if item.student_id not in active_ids]
    if unknown:
        raise HTTPException(status_code=404, detail=f"Студенты не найдены в группе урока: {unknown}")

    for item in data:
        await _upsert_mark(db, lesson_id, item.student_id, item, current_user)

    await db.commit()
    return {"ok": True, "saved": len(data)}


# Материалы урока: файлы, привязанные к уроку из общей «Базы знаний»
@router.get("/{lesson_id}/materials", response_model=list[LessonMaterialOut])
async def get_lesson_materials(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    added_by_user = aliased(User)
    rows = await db.execute(
        select(LessonMaterial, Material, added_by_user.full_name, added_by_user.username)
        .join(Material, Material.id == LessonMaterial.material_id)
        .outerjoin(added_by_user, added_by_user.id == LessonMaterial.added_by)
        .where(LessonMaterial.lesson_id == lesson_id)
        .order_by(LessonMaterial.added_at)
    )

    return [
        LessonMaterialOut(
            material_id=material.id,
            original_filename=material.original_filename,
            content_type=material.content_type,
            size_bytes=material.size_bytes,
            added_by_name=full_name or username,
            added_at=link.added_at,
        )
        for link, material, full_name, username in rows.all()
    ]


# Привязать файл из библиотеки к уроку
@router.post("/{lesson_id}/materials/{material_id}")
async def attach_lesson_material(
    lesson_id: int,
    material_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    material = await db.execute(select(Material).where(Material.id == material_id))
    if not material.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Файл не найден в базе знаний")

    existing = await db.execute(
        select(LessonMaterial).where(
            LessonMaterial.lesson_id == lesson_id,
            LessonMaterial.material_id == material_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"ok": True}

    db.add(LessonMaterial(
        lesson_id=lesson_id,
        material_id=material_id,
        added_by=current_user.id,
        added_at=datetime.now(dt_timezone.utc),
    ))
    await db.commit()
    return {"ok": True}


# Отвязать файл от урока (сам файл в библиотеке остаётся)
@router.delete("/{lesson_id}/materials/{material_id}")
async def detach_lesson_material(
    lesson_id: int,
    material_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    link = await db.execute(
        select(LessonMaterial).where(
            LessonMaterial.lesson_id == lesson_id,
            LessonMaterial.material_id == material_id,
        )
    )
    link = link.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Файл не привязан к этому уроку")

    await db.delete(link)
    await db.commit()
    return {"ok": True}


# Квизы урока (quiz.lesson_id — прямая связь, один квиз — максимум один урок)
@router.get("/{lesson_id}/quizzes", response_model=list[LessonQuizOut])
async def get_lesson_quizzes(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    rows = await db.execute(
        select(Quiz).where(Quiz.lesson_id == lesson_id).order_by(Quiz.created_at)
    )
    return rows.scalars().all()


# Привязать существующий квиз (из своей библиотеки) к уроку
@router.post("/{lesson_id}/quizzes/{quiz_id}")
async def attach_lesson_quiz(
    lesson_id: int,
    quiz_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    result = await db.execute(select(Quiz).where(Quiz.id == quiz_id))
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Квиз не найден")
    if current_user.role != "admin" and quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому квизу")

    quiz.lesson_id = lesson_id
    await db.commit()
    return {"ok": True}


# Отвязать квиз от урока (сам квиз остаётся в библиотеке автора)
@router.delete("/{lesson_id}/quizzes/{quiz_id}")
async def detach_lesson_quiz(
    lesson_id: int,
    quiz_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    result = await db.execute(
        select(Quiz).where(Quiz.id == quiz_id, Quiz.lesson_id == lesson_id)
    )
    quiz = result.scalar_one_or_none()
    if not quiz:
        raise HTTPException(status_code=404, detail="Квиз не привязан к этому уроку")
    if current_user.role != "admin" and quiz.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Нет доступа к этому квизу")

    quiz.lesson_id = None
    await db.commit()
    return {"ok": True}


@router.get("/{lesson_id}", response_model=LessonOut)
async def get_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    lesson = await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)
    return lesson


@router.patch("/{lesson_id}", response_model=LessonOut)
async def update_lesson(
    lesson_id: int,
    data: LessonUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    lesson = await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    update_data = data.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(lesson, field, value)

    await db.commit()
    await db.refresh(lesson)
    return lesson


@router.delete("/{lesson_id}")
async def delete_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    lesson = await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)
    await db.delete(lesson)
    await db.commit()
    return {"ok": True}


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

    # Для admin доступ к любой группе, для teacher — только к своей
    group_query = select(Group).where(Group.id == target_group_id)
    if current_user.role != "admin":
        group_query = group_query.where(Group.teacher_id == current_user.id)

    group = await db.execute(group_query)
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
