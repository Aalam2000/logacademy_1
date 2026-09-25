import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from datetime import datetime, date as date_type, timedelta, timezone as dt_timezone
from zoneinfo import ZoneInfo
from typing import Optional
from pydantic import BaseModel, Field
from ..database import get_db
from .. import storage
from ..models import (
    Lesson, Group, GroupMember, User, LessonMark, LessonResource, Material, Link, Quiz,
    HomeworkTask, HomeworkAnswer, HomeworkAnswerFile, LessonMessage,
)
from ..dependencies import require_teacher, get_current_user
from ..resources import RESOURCE_MODELS, RESOURCE_NOT_FOUND, fetch_resource_details, resource_exists

router = APIRouter(prefix="/lessons", tags=["lessons"])

BAKU_TZ = ZoneInfo("Asia/Baku")
ALLOWED_ATTENDANCE_STATUSES = {"in_person", "online", "excused", "absent"}


# Схемы прямо здесь — потом перенесём в schemas.py
# Слово «Урок» для автоназваний на языке интерфейса педагога. Берём готовый
# перевод из реестра autoi18n (translations/{lang}.json, ключ — sha1 исходной
# строки); перевода нет — остаётся «Урок».
LESSON_WORD = "Урок"


def lesson_word(lang: Optional[str]) -> str:
    import hashlib
    import json
    import os
    from .i18n import translator
    if not lang or lang == translator.source_lang:
        return LESSON_WORD
    try:
        with open(os.path.join(translator.cache_dir, f"{os.path.basename(lang)}.json"), encoding="utf-8") as f:
            return json.load(f).get(hashlib.sha1(LESSON_WORD.encode("utf-8")).hexdigest()) or LESSON_WORD
    except (OSError, ValueError):
        return LESSON_WORD


class LessonCreate(BaseModel):
    group_id: int
    title: Optional[str] = None  # не задано — «Урок» на языке интерфейса педагога (lang)
    lang: Optional[str] = None
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
    # Есть ответы на ДЗ без оценки — подсветка урока в списке и календаре
    has_unreviewed_homework: bool = False
    # Только для /lessons/student: что у студента в уроке не закрыто
    hw_todo: Optional[str] = None  # pending — сдать ДЗ | returned — вернули на доработку
    new_messages: int = 0          # новые реплики педагога в диалоге

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
    hw_grades: list[int] = []      # оценки за ДЗ этого урока (заданий может быть несколько)
    status_label: str = "—"        # посещаемость текстом: «Пришёл», «Онлайн», «Пропуск»…


class LessonItemOut(BaseModel):
    id: int  # lesson_resources.id
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


# Генератор расписания группы (claude/group-schedule-plan.md, задача 1).
# MVP: одно время на все выбранные дни недели, длина серии — количеством
# уроков (не датой окончания — так проще сочетается с шаблоном курса).
class ScheduleGenerate(BaseModel):
    group_id: int
    start_date: date_type
    start_time: str  # "HH:MM", одно и то же время для всех уроков серии
    weekdays: list[int] = Field(min_length=1)  # 0=Пн .. 6=Вс (date.weekday())
    lesson_count: int = Field(ge=1, le=200)
    fill_source: Optional[str] = None  # "template" | "group"
    fill_group_id: Optional[int] = None  # обязателен при fill_source == "group"
    lang: Optional[str] = None  # язык интерфейса педагога — на нём названия «Урок N»


# Дозаполнение/обновление материалов уже существующих уроков по шаблону
# курса или по другой (уже обкатанной) группе — сопоставление по
# порядковой позиции урока в серии, не по дате (claude/course-templates-plan.md).
class FillScheduleRequest(BaseModel):
    source: str  # "template" | "group"
    fill_group_id: Optional[int] = None  # обязателен при source == "group"
    range_from: int = Field(ge=1)
    range_to: int = Field(ge=1)
    mode: str = "add"  # "add" (Дополнить) | "replace" (Заменить)


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


async def get_accessible_group(group_id: int, db: AsyncSession, current_user: User) -> Group:
    """Доступ к группе для операций над расписанием: admin — к любой,
    teacher — только к своей. Используется генератором/дозаполнением/
    массовым удалением уроков — тот же контроль доступа, что и везде в
    этом файле, просто вынесен в одно место, чтобы не повторять запрос."""
    group_query = select(Group).where(Group.id == group_id)
    if current_user.role != "admin":
        group_query = group_query.where(Group.teacher_id == current_user.id)
    result = await db.execute(group_query)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=403, detail="Нет доступа к этой группе")
    return group


# Номер урока в шаблоне ("5.2", "5", "Урок 5") -> (модуль, день) для
# сортировки — та же схема, что parseLessonNo на фронте (KnowledgeBasePage.js).
# Нераспознанное отправляем в конец, чтобы не портило сортировку остальных.
def _parse_lesson_no(value: Optional[str]) -> tuple:
    if not value:
        return (10**6, 0)
    match = re.search(r"(\d+)(?:\D+(\d+))?", value)
    if not match:
        return (10**6, 0)
    major = int(match.group(1))
    minor = int(match.group(2)) if match.group(2) else 0
    return (major, minor)


# Шаблонные материалы курса+сектора (только approved), сгруппированные по
# ПОРЯДКОВОЙ позиции в серии — не по литеральному template_lesson_no
# (см. claude/course-templates-plan.md, "как считать номер урока"):
# берём все различные template_lesson_no, сортируем, нумеруем 1..K —
# эта позиция и сопоставляется с Lesson.order при заполнении.
async def _collect_template_positions(
    db: AsyncSession, course_id: int, sector: str
) -> dict[int, list[tuple[str, int]]]:
    tagged: list[tuple[str, int, str]] = []  # (resource_type, resource_id, template_lesson_no)
    for model, resource_type in ((Material, "material"), (Link, "link"), (Quiz, "quiz")):
        rows = await db.execute(
            select(model.id, model.template_lesson_no).where(
                model.course_id == course_id,
                model.sector == sector,
                model.template_status == "approved",
                model.template_lesson_no.isnot(None),
            )
        )
        for resource_id, lesson_no in rows.all():
            tagged.append((resource_type, resource_id, lesson_no))

    distinct_numbers = sorted({lesson_no for _, _, lesson_no in tagged}, key=_parse_lesson_no)
    position_by_no = {lesson_no: i + 1 for i, lesson_no in enumerate(distinct_numbers)}

    positions: dict[int, list[tuple[str, int]]] = {}
    for resource_type, resource_id, lesson_no in tagged:
        positions.setdefault(position_by_no[lesson_no], []).append((resource_type, resource_id))
    return positions


# Раскладывает подобранные по позиции ресурсы по конкретным урокам.
# mode="replace" — сперва отвязывает всё текущее у этих уроков (Заменить),
# mode="add" — просто добавляет недостающее, существующее не трогает
# (Дополнить). lesson.id должен быть уже присвоен (после db.flush()).
async def _apply_positions_to_lessons(
    db: AsyncSession,
    lessons_by_order: dict[int, Lesson],
    positions: dict[int, list[tuple[str, int]]],
    mode: str,
    current_user: User,
) -> int:
    attached = 0
    for order, lesson in lessons_by_order.items():
        items = positions.get(order, [])
        if mode == "replace":
            await db.execute(delete(LessonResource).where(LessonResource.lesson_id == lesson.id))
        for resource_type, resource_id in items:
            existing = await db.execute(
                select(LessonResource).where(
                    LessonResource.lesson_id == lesson.id,
                    LessonResource.resource_type == resource_type,
                    LessonResource.resource_id == resource_id,
                )
            )
            if existing.scalar_one_or_none():
                continue
            db.add(LessonResource(
                lesson_id=lesson.id,
                resource_type=resource_type,
                resource_id=resource_id,
                added_by=current_user.id,
                added_at=datetime.now(dt_timezone.utc),
            ))
            attached += 1
    return attached


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


# ---------- ДЗ: общее для уроков (сами эндпойнты ДЗ — routers/homework.py) ----------

def _safe_delete_object(object_key: str) -> None:
    try:
        storage.delete_object(object_key)
    except Exception:
        pass


def answer_is_submitted():
    """Ответ «пришёл», если в нём есть хотя бы один файл."""
    return select(HomeworkAnswerFile.id).where(HomeworkAnswerFile.answer_id == HomeworkAnswer.id).exists()


async def delete_homework_tasks(db: AsyncSession, task_ids: list[int]) -> None:
    """Задания + их персональные файлы (если больше нигде не используются).
    Ответы студентов привязаны к уроку, а не к заданию, — их не трогаем."""
    if not task_ids:
        return
    material_ids = {r[0] for r in (await db.execute(
        select(HomeworkTask.material_id).where(HomeworkTask.id.in_(task_ids))
    )).all()}
    await db.execute(delete(HomeworkTask).where(HomeworkTask.id.in_(task_ids)))
    for m in (await db.execute(
        select(Material).where(Material.id.in_(material_ids), Material.is_personal == True)
    )).scalars().all():
        still_used = (await db.execute(
            select(HomeworkTask.id).where(HomeworkTask.material_id == m.id).limit(1)
        )).first()
        if not still_used:
            _safe_delete_object(m.object_key)
            await db.delete(m)


async def delete_lessons_homework(db: AsyncSession, lesson_ids: list[int]) -> None:
    """Вызывать перед удалением уроков: задания, ответы студентов (+ файлы
    в MinIO) и диалоги в строках студентов."""
    if not lesson_ids:
        return
    answer_ids = [r[0] for r in (await db.execute(
        select(HomeworkAnswer.id).where(HomeworkAnswer.lesson_id.in_(lesson_ids))
    )).all()]
    if answer_ids:
        for (key,) in (await db.execute(
            select(HomeworkAnswerFile.object_key).where(HomeworkAnswerFile.answer_id.in_(answer_ids))
        )).all():
            _safe_delete_object(key)
        await db.execute(delete(HomeworkAnswerFile).where(HomeworkAnswerFile.answer_id.in_(answer_ids)))
        await db.execute(delete(HomeworkAnswer).where(HomeworkAnswer.id.in_(answer_ids)))
    task_ids = [r[0] for r in (await db.execute(
        select(HomeworkTask.id).where(HomeworkTask.lesson_id.in_(lesson_ids))
    )).all()]
    await delete_homework_tasks(db, task_ids)
    await db.execute(delete(LessonMessage).where(LessonMessage.lesson_id.in_(lesson_ids)))


async def with_unreviewed_flag(db: AsyncSession, lessons: list[Lesson]) -> list[LessonOut]:
    out = [LessonOut.model_validate(l) for l in lessons]
    if not out:
        return out
    rows = await db.execute(
        select(HomeworkAnswer.lesson_id)
        .where(
            HomeworkAnswer.lesson_id.in_([l.id for l in out]),
            HomeworkAnswer.grade.is_(None),
            HomeworkAnswer.accepted == False,
            HomeworkAnswer.reviewed_at.is_(None),  # не «вернули на доработку»
            answer_is_submitted(),
        )
        .distinct()
    )
    flagged = {row[0] for row in rows.all()}
    for item in out:
        item.has_unreviewed_homework = item.id in flagged
    return out


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
    return await with_unreviewed_flag(db, result.scalars().all())


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
        title=(data.title or "").strip() or lesson_word(data.lang),
        order=data.order,
        date=data.date,
        source=data.source,
        is_open=False
    )
    db.add(lesson)
    await db.commit()
    await db.refresh(lesson)
    return lesson


# Генератор расписания (claude/group-schedule-plan.md, задача 1). Требует
# пустую группу (без уроков) — если уроки уже есть, фронт сперва спрашивает
# педагога "удалить и пересоздать или дозаполнить материалами" и в первом
# случае явно вызывает DELETE /lessons/group/{id}, во втором — не вызывает
# generate вовсе, а сразу POST /lessons/group/{id}/fill-schedule.
#
# Праздники генератор НЕ вычисляет и не пропускает — никакого справочника
# праздников в системе нет (решение Андрея: такой справочник никто не
# ведёт). Если известный заранее праздник попадает в диапазон — педагог
# просто подбирает дату/дни недели так, чтобы обойти его, либо создаёт
# серию как есть и затем правит конкретный урок кнопкой на странице
# группы (POST /{lesson_id}/mark-holiday ниже) — она двигает вперёд его и
# все последующие уроки этой же группы.
@router.post("/generate", response_model=list[LessonOut])
async def generate_schedule(
    data: ScheduleGenerate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    group = await get_accessible_group(data.group_id, db, current_user)

    existing = await db.execute(select(Lesson.id).where(Lesson.group_id == data.group_id))
    if existing.first():
        raise HTTPException(
            status_code=409,
            detail="В группе уже есть уроки — удалите их (DELETE /lessons/group/{id}) либо дозаполните материалами вместо генерации",
        )

    try:
        hh, mm = (int(part) for part in data.start_time.split(":"))
        if not (0 <= hh <= 23 and 0 <= mm <= 59):
            raise ValueError
    except ValueError:
        raise HTTPException(status_code=422, detail="Неверный формат времени, ожидается ЧЧ:ММ")

    weekday_set = set(data.weekdays)
    if not weekday_set.issubset(set(range(7))):
        raise HTTPException(status_code=422, detail="День недели должен быть числом от 0 (Пн) до 6 (Вс)")

    dates: list[datetime] = []
    cursor = data.start_date
    # Предохранитель от зацикливания при некорректных входных данных —
    # не более (запрошено уроков × 30 + год) дней вперёд.
    safety_limit = data.lesson_count * 30 + 365
    steps = 0
    while len(dates) < data.lesson_count and steps < safety_limit:
        if cursor.weekday() in weekday_set:
            dates.append(datetime(cursor.year, cursor.month, cursor.day, hh, mm, tzinfo=BAKU_TZ))
        cursor += timedelta(days=1)
        steps += 1

    if len(dates) < data.lesson_count:
        raise HTTPException(status_code=422, detail="Не удалось подобрать достаточно дат — проверьте дни недели и период")

    lessons_by_order: dict[int, Lesson] = {}
    word = lesson_word(data.lang)
    for i, lesson_date in enumerate(dates, start=1):
        lesson = Lesson(
            group_id=data.group_id,
            title=f"{word} {i}",
            order=i,
            date=lesson_date,
            source="academy",
            is_open=False,
        )
        db.add(lesson)
        lessons_by_order[i] = lesson

    if data.fill_source:
        await db.flush()  # нужны id уроков для привязки ресурсов ниже
        if data.fill_source == "template":
            if not group.course_id or not group.sector:
                raise HTTPException(status_code=400, detail="У группы не указан курс или сектор — заполнение из шаблона невозможно")
            positions = await _collect_template_positions(db, group.course_id, group.sector)
        elif data.fill_source == "group":
            if not data.fill_group_id:
                raise HTTPException(status_code=422, detail="Укажите группу-источник материалов")
            source_lessons = await db.execute(select(Lesson).where(Lesson.group_id == data.fill_group_id))
            positions = {}
            for source_lesson in source_lessons.scalars().all():
                res_rows = await db.execute(
                    select(LessonResource.resource_type, LessonResource.resource_id)
                    .where(LessonResource.lesson_id == source_lesson.id)
                )
                items = res_rows.all()
                if items:
                    positions[source_lesson.order] = [(rt, rid) for rt, rid in items]
        else:
            raise HTTPException(status_code=422, detail="Недопустимый источник материалов")

        await _apply_positions_to_lessons(db, lessons_by_order, positions, mode="add", current_user=current_user)

    await db.commit()
    lessons = list(lessons_by_order.values())
    for lesson in lessons:
        await db.refresh(lesson)
    return lessons


# Дозаполнение/обновление материалов существующих уроков — отдельно от
# генерации: и как её необязательный последний шаг (см. выше), и как
# самостоятельная кнопка «Обновить материалы» (материалы готовятся
# пачками уже после того, как расписание создано).
@router.post("/group/{group_id}/fill-schedule")
async def fill_group_schedule(
    group_id: int,
    data: FillScheduleRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    group = await get_accessible_group(group_id, db, current_user)

    if data.range_from > data.range_to:
        raise HTTPException(status_code=422, detail="Некорректный диапазон уроков")
    if data.mode not in ("add", "replace"):
        raise HTTPException(status_code=422, detail="Недопустимый режим заполнения")

    target_result = await db.execute(
        select(Lesson).where(
            Lesson.group_id == group_id,
            Lesson.order >= data.range_from,
            Lesson.order <= data.range_to,
        )
    )
    lessons_by_order = {lesson.order: lesson for lesson in target_result.scalars().all()}
    if not lessons_by_order:
        raise HTTPException(status_code=404, detail="В указанном диапазоне нет уроков")

    if data.source == "template":
        if not group.course_id or not group.sector:
            raise HTTPException(status_code=400, detail="У группы не указан курс или сектор — заполнение из шаблона невозможно")
        positions = await _collect_template_positions(db, group.course_id, group.sector)
    elif data.source == "group":
        if not data.fill_group_id:
            raise HTTPException(status_code=422, detail="Укажите группу-источник материалов")
        source_lessons = await db.execute(select(Lesson).where(Lesson.group_id == data.fill_group_id))
        positions = {}
        for source_lesson in source_lessons.scalars().all():
            res_rows = await db.execute(
                select(LessonResource.resource_type, LessonResource.resource_id)
                .where(LessonResource.lesson_id == source_lesson.id)
            )
            items = res_rows.all()
            if items:
                positions[source_lesson.order] = [(rt, rid) for rt, rid in items]
    else:
        raise HTTPException(status_code=422, detail="Недопустимый источник материалов")

    attached = await _apply_positions_to_lessons(db, lessons_by_order, positions, data.mode, current_user)
    await db.commit()
    return {"ok": True, "attached": attached}


# Массовое удаление всех уроков группы — шаг "удалить и пересоздать
# заново" в диалоге генератора (см. generate_schedule выше). Отдельный
# явный вызов с фронта, а не часть generate, чтобы не удалить уроки молча.
@router.delete("/group/{group_id}")
async def delete_group_lessons(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    await get_accessible_group(group_id, db, current_user)

    lesson_ids_result = await db.execute(select(Lesson.id).where(Lesson.group_id == group_id))
    lesson_ids = [row[0] for row in lesson_ids_result.all()]
    if lesson_ids:
        await delete_lessons_homework(db, lesson_ids)
        await db.execute(delete(LessonMark).where(LessonMark.lesson_id.in_(lesson_ids)))
        await db.execute(delete(LessonResource).where(LessonResource.lesson_id.in_(lesson_ids)))
        await db.execute(delete(Lesson).where(Lesson.group_id == group_id))
        await db.commit()
    return {"ok": True, "deleted": len(lesson_ids)}


# Все уроки педагога (для главной страницы и календаря на /groups).
# У admin — тот же выбор области видимости, что и в /groups/my:
# teacher_id=<id> — уроки групп конкретного препода, mine=true — только
# своих (если они у админа есть), ни то ни другое — уроки вообще всех групп.
@router.get("/my", response_model=list[LessonOut])
async def get_my_lessons(
    teacher_id: Optional[int] = None,
    mine: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    groups_query = select(Group)
    if current_user.role != "admin":
        groups_query = groups_query.where(Group.teacher_id == current_user.id)
    elif mine:
        groups_query = groups_query.where(Group.teacher_id == current_user.id)
    elif teacher_id is not None:
        groups_query = groups_query.where(Group.teacher_id == teacher_id)

    groups_result = await db.execute(groups_query)
    group_ids = [g.id for g in groups_result.scalars().all()]
    if not group_ids:
        return []
    result = await db.execute(
        select(Lesson)
        .where(Lesson.group_id.in_(group_ids))
        .order_by(Lesson.date)
    )
    return await with_unreviewed_flag(db, result.scalars().all())


# Уроки студента — только открытые
# ВАЖНО: должен идти раньше маршрутов с /{lesson_id} ниже — иначе FastAPI
# сопоставляет "/lessons/student" с /{lesson_id} (lesson_id="student"),
# который требует роль teacher/admin, и студент получает 403.
# include_closed=1 — ещё и закрытые педагогом уроки (только дата/тема — для
# календаря студента; открыть закрытый урок студент по-прежнему не может)
@router.get("/student", response_model=list[LessonOut])
async def get_student_lessons(
    include_closed: bool = False,
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
        .where(Lesson.group_id.in_(group_ids), *([] if include_closed else [Lesson.is_open == True]))
        .order_by(Lesson.date.desc())
    )
    from .homework import student_open_items  # homework.py сам импортирует lessons.py
    out = [LessonOut.model_validate(l) for l in result.scalars().all()]
    flags = await student_open_items(db, [l.id for l in out], current_user.id)
    for item in out:
        item.hw_todo, item.new_messages = flags.get(item.id, (None, 0))
    return out


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

    rows = rows.all()
    hw_by_lesson: dict[int, list[int]] = {}
    lesson_ids = [lesson.id for lesson, _ in rows]
    if lesson_ids:
        for lesson_id, grade in (await db.execute(
            select(HomeworkAnswer.lesson_id, HomeworkAnswer.grade)
            .where(
                HomeworkAnswer.lesson_id.in_(lesson_ids),
                HomeworkAnswer.student_id == current_user.id,
                HomeworkAnswer.grade.isnot(None),
            )
        )).all():
            hw_by_lesson.setdefault(lesson_id, []).append(grade)

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
            hw_grades=hw_by_lesson.get(lesson.id, []),
            status_label=_STATUS_LABELS.get(mark.attendance_status, "—") if mark else "—",
        )
        for lesson, mark in rows
    ]


class GradeItemOut(BaseModel):
    date: Optional[datetime] = None
    lesson_title: str
    title: Optional[str] = None   # для ДЗ — название задания
    grade: int


class GradeGroupOut(BaseModel):
    avg: Optional[float] = None
    max: Optional[int] = None
    items: list[GradeItemOut] = []


class MyGradesOut(BaseModel):
    lesson: GradeGroupOut     # оценка за урок
    homework: GradeGroupOut   # оценка за ДЗ
    exam: GradeGroupOut       # экзаменационная


def _grade_group(items: list[GradeItemOut]) -> GradeGroupOut:
    grades = [i.grade for i in items]
    return GradeGroupOut(
        avg=round(sum(grades) / len(grades), 1) if grades else None,
        max=max(grades) if grades else None,
        items=items,
    )


# Три вида оценок студента (за урок / за ДЗ / экзаменационная) — каждая со
# своей средней и списком «дата — оценка». Открытые уроки активных групп,
# как и /student/marks. ДОЛЖЕН идти раньше маршрутов с /{lesson_id}.
@router.get("/student/grades", response_model=MyGradesOut)
async def get_student_grades(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Только для студента")

    group_ids = [r[0] for r in (await db.execute(
        select(GroupMember.group_id).where(
            GroupMember.student_id == current_user.id, GroupMember.status == "active",
        )
    )).all()]
    lesson_items: list[GradeItemOut] = []
    exam_items: list[GradeItemOut] = []
    hw_items: list[GradeItemOut] = []
    if group_ids:
        for lesson, mark in (await db.execute(
            select(Lesson, LessonMark)
            .join(LessonMark, (LessonMark.lesson_id == Lesson.id) & (LessonMark.student_id == current_user.id))
            .where(Lesson.group_id.in_(group_ids), Lesson.is_open == True)
            .order_by(Lesson.date.desc())
        )).all():
            if mark.score is not None:
                lesson_items.append(GradeItemOut(date=lesson.date, lesson_title=lesson.title, grade=mark.score))
            if mark.exam_score is not None:
                exam_items.append(GradeItemOut(date=lesson.date, lesson_title=lesson.title, grade=mark.exam_score))

        for lesson, answer in (await db.execute(
            select(Lesson, HomeworkAnswer)
            .join(HomeworkAnswer, HomeworkAnswer.lesson_id == Lesson.id)
            .where(
                Lesson.group_id.in_(group_ids), Lesson.is_open == True,
                HomeworkAnswer.student_id == current_user.id, HomeworkAnswer.grade.isnot(None),
            )
            .order_by(Lesson.date.desc())
        )).all():
            hw_items.append(GradeItemOut(
                date=answer.reviewed_at or lesson.date, lesson_title=lesson.title, grade=answer.grade,
            ))

    return MyGradesOut(
        lesson=_grade_group(lesson_items),
        homework=_grade_group(hw_items),
        exam=_grade_group(exam_items),
    )


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


# "Это выходной" — для непредвиденного праздника (не учтённого при
# генерации, никакого справочника праздников в системе нет — см.
# claude/group-schedule-plan.md). Действует только на ЭТУ группу: сам
# урок и его материалы/оценки не трогаем — просто сдвигаем даты у него и
# у всех последующих уроков этой серии на одну позицию вперёд (по тому же
# шагу, что был между последними двумя уроками серии), а в конце
# добавляется одна новая дата по этому же шагу.
@router.post("/{lesson_id}/mark-holiday", response_model=list[LessonOut])
async def mark_lesson_as_holiday(
    lesson_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    lesson = await get_lesson_for_teacher_or_admin(lesson_id, db, current_user)
    if lesson.date is None:
        raise HTTPException(status_code=400, detail="У урока не задана дата")

    tail_result = await db.execute(
        select(Lesson)
        .where(Lesson.group_id == lesson.group_id, Lesson.order >= lesson.order)
        .order_by(Lesson.order)
    )
    tail = tail_result.scalars().all()

    old_dates = [l.date for l in tail]
    step = (old_dates[-1] - old_dates[-2]) if len(tail) >= 2 else timedelta(days=7)

    for i in range(len(tail) - 1):
        tail[i].date = old_dates[i + 1]
    tail[-1].date = old_dates[-1] + step

    await db.commit()
    for l in tail:
        await db.refresh(l)
    return tail


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
            id=attachment.id,
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
    # ДЗ урока (задания, ответы, их файлы в MinIO) и диалоги — тоже данные
    # внутри урока, удаляются вместе с ним.
    await delete_lessons_homework(db, [lesson_id])
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
