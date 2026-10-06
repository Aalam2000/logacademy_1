"""Статус домашнего задания ученика — одно правило для всех экранов
(роутер ДЗ routers/homework.py, отчёт по ученику student_report.py).

ДЗ ученика в уроке = общие задания урока + его персональные. Ответ один на
всё ДЗ урока. Статус:
  none      — ДЗ не выдано;
  graded    — оценено; accepted — принято без оценки;
  returned  — педагог вернул на доработку (проверка была, оценки и «принято» нет);
  submitted — ответ прислан, ждёт проверки;
  expired   — ответа нет, срок прошёл; pending — ответа нет, срок не прошёл.
"""
from datetime import datetime, timezone
from typing import Iterable, Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from .models import HomeworkAnswer, HomeworkAnswerFile, HomeworkTask, Lesson


def expired(deadline: Optional[datetime]) -> bool:
    if deadline is None:
        return False
    if deadline.tzinfo is None:
        deadline = deadline.replace(tzinfo=timezone.utc)
    return datetime.now(timezone.utc) > deadline


def task_is_for(task: HomeworkTask, student_id: int) -> bool:
    return task.student_id is None or task.student_id == student_id


def effective_deadline(tasks: list[HomeworkTask]) -> Optional[datetime]:
    """Срок всего ДЗ студента: самый поздний из сроков его заданий; если у
    какого-то задания срока нет — срока нет."""
    if not tasks or any(t.deadline is None for t in tasks):
        return None
    return max(t.deadline for t in tasks)


def answer_status(tasks: list[HomeworkTask], answer: Optional[HomeworkAnswer], has_files: bool) -> str:
    if not tasks:
        return "none"
    if answer is not None and answer.grade is not None:
        return "graded"
    if answer is not None and answer.accepted:
        return "accepted"
    if answer is not None and answer.reviewed_at is not None:
        # педагог вернул на доработку (оценки нет, «принято» нет, но проверка была);
        # снова «submitted» — когда студент загрузит новый файл
        return "returned"
    if has_files:
        return "submitted"
    return "expired" if expired(effective_deadline(tasks)) else "pending"


def awaiting_review() -> tuple:
    """Условия на HomeworkAnswer: ответ прислан (есть файл) и ждёт проверки —
    оценки нет, «принято» нет, на доработку не возвращён. По ним подсвечиваются
    урок, группа и флаг «Проверь ДЗ» у педагога, считается очередь в отчёте."""
    return (
        HomeworkAnswer.grade.is_(None),
        HomeworkAnswer.accepted == False,  # noqa: E712
        HomeworkAnswer.reviewed_at.is_(None),
        select(HomeworkAnswerFile.id).where(HomeworkAnswerFile.answer_id == HomeworkAnswer.id).exists(),
    )


async def to_review_by_group(db: AsyncSession, group_ids: Iterable[int]) -> dict[int, int]:
    """group_id → сколько ответов на ДЗ ждут проверки (группы без таких ответов не попадают)."""
    group_ids = list(group_ids)
    if not group_ids:
        return {}
    rows = await db.execute(
        select(Lesson.group_id, func.count(HomeworkAnswer.id))
        .join(Lesson, Lesson.id == HomeworkAnswer.lesson_id)
        .where(Lesson.group_id.in_(group_ids), *awaiting_review())
        .group_by(Lesson.group_id)
    )
    return {gid: count for gid, count in rows.all()}


async def oldest_lesson_to_review(db: AsyncSession, group_ids: Iterable[int]) -> Optional[int]:
    """Урок с самым давним ответом, который ждёт проверки, — с него начинать."""
    group_ids = list(group_ids)
    if not group_ids:
        return None
    row = (await db.execute(
        select(HomeworkAnswer.lesson_id)
        .join(Lesson, Lesson.id == HomeworkAnswer.lesson_id)
        .where(Lesson.group_id.in_(group_ids), *awaiting_review())
        .order_by(HomeworkAnswer.updated_at, HomeworkAnswer.id)
        .limit(1)
    )).first()
    return row[0] if row else None


async def student_homework(db: AsyncSession, lesson_ids: Iterable[int], student_id: int) -> dict[int, dict]:
    """ДЗ ученика по урокам, пачкой: lesson_id → {status, grade, deadline}."""
    lesson_ids = list(lesson_ids)
    if not lesson_ids:
        return {}
    tasks_by_lesson: dict[int, list[HomeworkTask]] = {}
    for t in (await db.execute(select(HomeworkTask).where(HomeworkTask.lesson_id.in_(lesson_ids)))).scalars().all():
        if task_is_for(t, student_id):
            tasks_by_lesson.setdefault(t.lesson_id, []).append(t)
    answers = {a.lesson_id: a for a in (await db.execute(select(HomeworkAnswer).where(
        HomeworkAnswer.lesson_id.in_(lesson_ids), HomeworkAnswer.student_id == student_id,
    ))).scalars().all()}
    with_files: set[int] = set()
    if answers:
        with_files = {row[0] for row in (await db.execute(
            select(HomeworkAnswerFile.answer_id)
            .where(HomeworkAnswerFile.answer_id.in_([a.id for a in answers.values()])).distinct()
        )).all()}
    out = {}
    for lid in lesson_ids:
        tasks = tasks_by_lesson.get(lid, [])
        answer = answers.get(lid)
        out[lid] = {
            "status": answer_status(tasks, answer, bool(answer and answer.id in with_files)),
            "grade": answer.grade if answer else None,
            "deadline": effective_deadline(tasks),
        }
    return out
