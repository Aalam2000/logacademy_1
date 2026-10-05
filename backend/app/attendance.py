"""Посещаемость — единое правило для всех экранов (claude/attendance-plan.md).

Слот посещаемости = (ученик, урок), если:
  - урок уже заблокирован (прошла полночь дня урока по Баку, lesson_lock.py);
  - ученик в этот день состоял в группе: день урока не раньше дня добавления
    (joined_at) и урок раньше отчисления (expelled_at), если отчислен;
  - если урок персональный — ученик его участник (personal.py); остальным
    ученикам группы слот не создаётся, пропуск им не ставится.
Статус слота: in_person / online / excused — как отмечено педагогом; всё
остальное (ничего не отмечено, отметки нет вовсе, absent) — пропуск.

Уроки до блокировки в посещаемость не входят вообще — их ещё можно отметить.
Отсюда берут цифры: «Студенты» и PDF-карточка (students.py), «Преподаватели»
(admin.py), «Успеваемость» и «моя отметка» студента (lessons.py).
"""
from dataclasses import dataclass
from typing import Iterable, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .lesson_lock import lock_cutoff, baku_day, aware
from .models import GroupMember, Lesson, LessonMark
from .personal import participants_by_lesson

PRESENT = {"in_person", "online"}
EXCUSED = "excused"
ABSENT = "absent"


@dataclass(frozen=True)
class AttendanceSlot:
    student_id: int
    lesson_id: int
    group_id: int
    status: str  # in_person | online | excused | absent


@dataclass
class AttendanceSummary:
    present: int = 0
    excused: int = 0
    absent: int = 0

    @property
    def pct(self) -> Optional[float]:
        # Уважительная причина не портит процент — не входит ни в числитель, ни в знаменатель
        counted = self.present + self.absent
        return round(self.present / counted * 100, 1) if counted else None

    def add(self, status: str) -> None:
        if status in PRESENT:
            self.present += 1
        elif status == EXCUSED:
            self.excused += 1
        else:
            self.absent += 1


async def attendance_slots(
    db: AsyncSession,
    group_ids: Iterable[int],
    student_ids: Optional[Iterable[int]] = None,
    lesson_ids: Optional[Iterable[int]] = None,
) -> list[AttendanceSlot]:
    """Все слоты посещаемости в заданных группах (опционально — только эти
    ученики / уроки). Три запроса независимо от числа учеников и уроков."""
    group_ids = list(group_ids)
    if not group_ids:
        return []

    members_q = select(
        GroupMember.group_id, GroupMember.student_id, GroupMember.joined_at, GroupMember.expelled_at,
    ).where(GroupMember.group_id.in_(group_ids))
    if student_ids is not None:
        members_q = members_q.where(GroupMember.student_id.in_(list(student_ids)))
    members = (await db.execute(members_q)).all()
    if not members:
        return []

    lessons_q = select(Lesson.id, Lesson.group_id, Lesson.date, Lesson.is_personal).where(
        Lesson.group_id.in_(group_ids),
        Lesson.date.isnot(None),
        Lesson.date < lock_cutoff(),
    )
    if lesson_ids is not None:
        lessons_q = lessons_q.where(Lesson.id.in_(list(lesson_ids)))
    lessons_by_group: dict[int, list] = {}
    personal_ids: list[int] = []
    for lesson_id, gid, lesson_date, is_personal in (await db.execute(lessons_q)).all():
        lessons_by_group.setdefault(gid, []).append((lesson_id, lesson_date))
        if is_personal:
            personal_ids.append(lesson_id)
    if not lessons_by_group:
        return []

    all_lesson_ids = [lid for rows in lessons_by_group.values() for lid, _ in rows]
    marks_q = select(LessonMark.lesson_id, LessonMark.student_id, LessonMark.attendance_status).where(
        LessonMark.lesson_id.in_(all_lesson_ids)
    )
    if student_ids is not None:
        marks_q = marks_q.where(LessonMark.student_id.in_([m.student_id for m in members]))
    marks = {(lid, sid): status for lid, sid, status in (await db.execute(marks_q)).all()}

    # Персональные уроки: слот только у участников
    participants = await participants_by_lesson(db, personal_ids)
    personal = set(personal_ids)

    slots = []
    for gid, sid, joined_at, expelled_at in members:
        joined_day = baku_day(joined_at) if joined_at else None
        for lesson_id, lesson_date in lessons_by_group.get(gid, []):
            if joined_day and baku_day(lesson_date) < joined_day:
                continue  # урок до добавления в группу
            if expelled_at and aware(lesson_date) >= aware(expelled_at):
                continue  # урок после отчисления
            if lesson_id in personal and sid not in participants.get(lesson_id, ()):
                continue  # персональный урок без этого ученика
            status = marks.get((lesson_id, sid))
            if status not in PRESENT and status != EXCUSED:
                status = ABSENT
            slots.append(AttendanceSlot(sid, lesson_id, gid, status))
    return slots


def summarize_by_student(slots: Iterable[AttendanceSlot]) -> dict[int, AttendanceSummary]:
    out: dict[int, AttendanceSummary] = {}
    for s in slots:
        out.setdefault(s.student_id, AttendanceSummary()).add(s.status)
    return out


def summarize(slots: Iterable[AttendanceSlot]) -> AttendanceSummary:
    total = AttendanceSummary()
    for s in slots:
        total.add(s.status)
    return total
