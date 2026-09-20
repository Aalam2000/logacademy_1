from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, timezone as dt_timezone
from zoneinfo import ZoneInfo
from typing import Optional
from pydantic import BaseModel, Field
from ..database import get_db
from ..models import Lesson, Group, GroupMember, User, LessonMark, LessonResource
from ..dependencies import require_teacher, get_current_user
from ..resources import RESOURCE_MODELS, RESOURCE_NOT_FOUND, fetch_resource_details, resource_exists

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
    comment: Optional[str] = None

class LessonOut(BaseModel):
    id: int
    group_id: int
    title: str
    order: int
    date: Optional[datetime]
    is_open: bool
    source: Optional[str]
    comment: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LessonMarkIn(BaseModel):
    attendance_status: Optional[str] = None  # in_person | online | excused | absent | None
    is_late: bool = False
    score: Optional[int] = Field(default=None, ge=0, le=100)
    exam_score: Optional[int] = Field(default=None, ge=0, le=100)  # ставит препод вручную или живой квиз-"Экзамен"
    stars: Optional[int] = Field(default=None, ge=0, le=3)
    comment: Optional[str] = None


class LessonMarkBulkItem(LessonMarkIn):
    student_id: int


class LessonMarkOut(BaseModel):
    student_id: int
    full_name: Optional[str]
    telegram_username: Optional[str] = None
    whatsapp: Optional[str] = None
    attendance_status: Optional[str]
    is_late: bool
    score: Optional[int]
    exam_score: Optional[int]
    stars: Optional[int]
    comment: Optional[str]
    marked_at: Optional[datetime]


class MyLessonMarkOut(BaseModel):
    attendance_status: Optional[str]
    is_late: bool
    status_label: str  # человекочитаемый статус для студента, см. _build_status_label
    score: Optional[int]
    exam_score: Optional[int]
    stars: Optional[int]
    comment: Optional[str]
    marked_at: Optional[datetime]


class MyPerformanceRowOut(BaseModel):
    lesson_id: int
    lesson_title: str
    date: Optional[datetime]
    attendance_status: Optional[str]
    is_late: bool
    score: Optional[int]
    exam_score: Optional[int]
    comment: Optional[str]


class LessonItemOut(BaseModel):
    resource_type: str  # material | quiz | link
    resource_id: int
    title: str
    content_type: Optional[str] = None   # material
    size_bytes: Optional[int] = None     # material
    template_type: Optional[str] = None  # quiz
    topic: Optional[str] = None          # quiz
    url: Optional[str] = None            # link
    added_by_name: Optional[str] = None
    added_at: Optional[datetime] = None


class LessonItemAttach(BaseModel):
    resource_type: str  # material | quiz | link
    resource_id: int


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


# Текстовый статус для студента — та же логика, что у полей учителя
# (attendance_status + независимый is_late), просто словами и без
# контролов. is_late осмыслен только при in_person/online — как и в форме
# учителя, где чекбокс "опоздал" задизейблен для остальных статусов.
_STATUS_LABELS = {
    "in_person": "Был",
    "online": "Онлайн",
    "excused": "Ув.прич",
    "absent": "Пропуск",
}


def _build_status_label(attendance_status: Optional[str], is_late: bool) -> str:
    base = _STATUS_LABELS.get(attendance_status)
    if base is None:
        return "—"
    if is_late and attendance_status in ("in_person", "online"):
        return f"{base}, опоздал"
    return base


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


async def get_lesson_for_student(
    lesson_id: int,
    db: AsyncSession,
    current_user: User
) -> Lesson:
    result = await db.execute(select(Lesson).where(Lesson.id == lesson_id))
    lesson = result.scalar_one_or_none()
    if not lesson:
        raise HTTPException(status_code=404, detail="Урок не найден")

    if not lesson.is_open:
        raise HTTPException(status_code=403, detail="Урок ещё не открыт")

    member = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == lesson.group_id,
            GroupMember.student_id == current_user.id,
            GroupMember.status == "active",
        )
    )
    if not member.scalar_one_or_none():
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
        .order_by(Lesson.date.desc())
    )
    return result.scalars().all()


# Успеваемость студента: оценки/экзамены/комменты и посещаемость по всем
# открытым урокам его групп, одним запросом (вместо /marks/me на каждый
# урок) — для раздела «Успеваемость» в личном кабинете. ДОЛЖЕН идти раньше
# /{lesson_id}/marks ниже — та же причина, что и у /student выше.
@router.get("/student/marks", response_model=list[MyPerformanceRowOut])
async def get_student_marks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Только для студента")

    members_result = await db.execute(
        select(GroupMember).where(
            GroupMember.student_id == current_user.id,
            GroupMember.status == "active",
        )
    )
    group_ids = [m.group_id for m in members_result.scalars().all()]
    if not group_ids:
        return []

    rows = await db.execute(
        select(Lesson, LessonMark)
        .outerjoin(
            LessonMark,
            (LessonMark.lesson_id == Lesson.id) & (LessonMark.student_id == current_user.id),
        )
        .where(Lesson.group_id.in_(group_ids), Lesson.is_open == True)
        .order_by(Lesson.date.desc())
    )

    return [
        MyPerformanceRowOut(
            lesson_id=lesson.id,
            lesson_title=lesson.title,
            date=lesson.date,
            attendance_status=mark.attendance_status if mark else None,
            is_late=mark.is_late if mark else False,
            score=mark.score if mark else None,
            exam_score=mark.exam_score if mark else None,
            comment=mark.comment if mark else None,
        )
        for lesson, mark in rows.all()
    ]


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
    mark.exam_score = data.exam_score
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
            telegram_username=user.telegram_username,
            whatsapp=user.whatsapp,
            attendance_status=mark.attendance_status if mark else None,
            is_late=mark.is_late if mark else False,
            score=mark.score if mark else None,
            exam_score=mark.exam_score if mark else None,
            stars=mark.stars if mark else None,
            comment=mark.comment if mark else None,
            marked_at=mark.marked_at if mark else None,
        ))

    return {
        "locked": is_lesson_locked(lesson) and current_user.role != "admin",
        "students": students,
    }


# Своя отметка студента — read-only, без доступа к оценкам одногруппников
@router.get("/{lesson_id}/marks/me", response_model=MyLessonMarkOut)
async def get_my_lesson_mark(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Только для студента")

    await get_lesson_for_student(lesson_id, db, current_user)

    result = await db.execute(
        select(LessonMark).where(
            LessonMark.lesson_id == lesson_id,
            LessonMark.student_id == current_user.id,
        )
    )
    mark = result.scalar_one_or_none()

    attendance_status = mark.attendance_status if mark else None
    is_late = mark.is_late if mark else False

    return MyLessonMarkOut(
        attendance_status=attendance_status,
        is_late=is_late,
        status_label=_build_status_label(attendance_status, is_late),
        score=mark.score if mark else None,
        exam_score=mark.exam_score if mark else None,
        stars=mark.stars if mark else None,
        comment=mark.comment if mark else None,
        marked_at=mark.marked_at if mark else None,
    )


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
    if is_lesson_locked(lesson) and current_user.role != "admin":
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
    if is_lesson_locked(lesson) and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Урок заблокирован для редактирования (прошла полночь по Баку)")

    active_ids = await _get_active_group_student_ids(lesson, db)
    unknown = [item.student_id for item in data if item.student_id not in active_ids]
    if unknown:
        raise HTTPException(status_code=404, detail=f"Студенты не найдены в группе урока: {unknown}")

    for item in data:
        await _upsert_mark(db, lesson_id, item.student_id, item, current_user)

    await db.commit()
    return {"ok": True, "saved": len(data)}


# Материалы урока: всё привязанное (файл/квиз/ссылка) из общей «Базы
# знаний» — группировка фиксированная: файлы → ссылки → квизы, внутри
# группы — по дате привязки.
_TYPE_ORDER = {"material": 0, "link": 1, "quiz": 2}


@router.get("/{lesson_id}/items", response_model=list[LessonItemOut])
async def get_lesson_items(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "student":
        await get_lesson_for_student(lesson_id, db, current_user)
    else:
        await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    rows = await db.execute(
        select(LessonResource, User.full_name, User.username)
        .outerjoin(User, User.id == LessonResource.added_by)
        .where(LessonResource.lesson_id == lesson_id)
    )
    attachments = rows.all()

    ids_by_type: dict[str, set[int]] = {}
    for attachment, _, _ in attachments:
        ids_by_type.setdefault(attachment.resource_type, set()).add(attachment.resource_id)

    details: dict[tuple[str, int], dict] = {}
    for resource_type, ids in ids_by_type.items():
        for row in await fetch_resource_details(db, resource_type, ids):
            details[(resource_type, row["id"])] = row

    items = []
    for attachment, full_name, username in attachments:
        detail = details.get((attachment.resource_type, attachment.resource_id))
        if not detail:
            continue  # ресурс удалён из библиотеки, привязка осиротела

        items.append(LessonItemOut(
            resource_type=detail["resource_type"],
            resource_id=detail["id"],
            title=detail["title"],
            content_type=detail["content_type"],
            size_bytes=detail["size_bytes"],
            template_type=detail["template_type"],
            topic=detail["topic"],
            url=detail["url"],
            added_by_name=full_name or username,
            added_at=attachment.added_at,
        ))

    items.sort(key=lambda i: (_TYPE_ORDER[i.resource_type], i.added_at or datetime.min))
    if current_user.role == "student":
        items = [item for item in items if item.resource_type != "quiz"]
    return items


# Привязать ресурс (файл/квиз/ссылка) из библиотеки к уроку — общий
# эндпойнт вместо трёх отдельных под каждый тип.
@router.post("/{lesson_id}/items")
async def attach_lesson_item(
    lesson_id: int,
    data: LessonItemAttach,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    if data.resource_type not in RESOURCE_MODELS:
        raise HTTPException(status_code=422, detail="Недопустимый тип ресурса")
    if not await resource_exists(db, data.resource_type, data.resource_id):
        raise HTTPException(status_code=404, detail=RESOURCE_NOT_FOUND[data.resource_type])

    existing = await db.execute(
        select(LessonResource).where(
            LessonResource.lesson_id == lesson_id,
            LessonResource.resource_type == data.resource_type,
            LessonResource.resource_id == data.resource_id,
        )
    )
    if existing.scalar_one_or_none():
        return {"ok": True}

    db.add(LessonResource(
        lesson_id=lesson_id,
        resource_type=data.resource_type,
        resource_id=data.resource_id,
        added_by=current_user.id,
        added_at=datetime.now(dt_timezone.utc),
    ))
    await db.commit()
    return {"ok": True}


# Отвязать ресурс от урока (сам ресурс остаётся в библиотеке)
@router.delete("/{lesson_id}/items/{resource_type}/{resource_id}")
async def detach_lesson_item(
    lesson_id: int,
    resource_type: str,
    resource_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)

    result = await db.execute(
        select(LessonResource).where(
            LessonResource.lesson_id == lesson_id,
            LessonResource.resource_type == resource_type,
            LessonResource.resource_id == resource_id,
        )
    )
    attachment = result.scalar_one_or_none()
    if not attachment:
        raise HTTPException(status_code=404, detail="Ресурс не привязан к этому уроку")

    await db.delete(attachment)
    await db.commit()
    return {"ok": True}


@router.get("/{lesson_id}", response_model=LessonOut)
async def get_lesson(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role == "student":
        lesson = await get_lesson_for_student(lesson_id, db, current_user)
    else:
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

    # lesson_marks/lesson_resources ссылаются на lessons.id без ON DELETE
    # CASCADE (и без ORM-relationship с каскадом) — без этого удаление
    # урока с уже проставленными оценками или привязанными материалами
    # падало на ограничении внешнего ключа. Сами материалы/квизы/ссылки
    # в «Базе знаний» не трогаем — удаляем только привязки этого урока.
    await db.execute(delete(LessonMark).where(LessonMark.lesson_id == lesson_id))
    await db.execute(delete(LessonResource).where(LessonResource.lesson_id == lesson_id))

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
