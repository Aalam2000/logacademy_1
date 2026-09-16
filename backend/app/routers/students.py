import io
from datetime import datetime
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from xhtml2pdf import pisa

from ..database import get_db
from ..dependencies import require_teacher
from ..models import Course, Group, GroupMember, Lesson, LessonMark, User
from .i18n import translator

router = APIRouter(prefix="/students", tags=["students"])

# Эти статусы не считаются пропуском по неуважительной причине.
# Всё остальное (NULL — ничего не отмечено, или "absent") — пропуск.
EXCUSED_OR_PRESENT = {"in_person", "online", "excused"}


class StudentGroupOut(BaseModel):
    id: int
    name: str
    teacher_id: int
    teacher_name: Optional[str] = None


class StudentStatsOut(BaseModel):
    id: int
    full_name: str
    telegram_username: Optional[str] = None
    whatsapp: Optional[str] = None
    avg_score: Optional[float] = None
    max_score: Optional[int] = None
    unexcused_absences: int = 0
    late_count: int = 0
    groups: list[StudentGroupOut] = []


async def _scope_group_ids(
    db: AsyncSession,
    current_user: User,
    course_id: Optional[int] = None,
    group_id: Optional[int] = None,
    teacher_id: Optional[int] = None,
    mine: bool = False,
) -> dict[int, dict]:
    """Группы в допустимой области видимости пользователя + фильтрам.
    Возвращает {group_id: {id, name, teacher_id, teacher_name, course_id, course_title}}."""
    scope_teacher_id = None
    if current_user.role != "admin":
        scope_teacher_id = current_user.id
    elif mine:
        scope_teacher_id = current_user.id
    elif teacher_id is not None:
        scope_teacher_id = teacher_id

    query = select(Group.id, Group.name, Group.teacher_id, Group.course_id)
    if scope_teacher_id is not None:
        query = query.where(Group.teacher_id == scope_teacher_id)
    if course_id is not None:
        query = query.where(Group.course_id == course_id)
    if group_id is not None:
        query = query.where(Group.id == group_id)

    result = await db.execute(query)
    groups_by_id = {
        gid: {"id": gid, "name": name, "teacher_id": tid, "course_id": cid, "teacher_name": None, "course_title": None}
        for gid, name, tid, cid in result.all()
    }
    if not groups_by_id:
        return groups_by_id

    teacher_ids = list({g["teacher_id"] for g in groups_by_id.values()})
    teachers_result = await db.execute(
        select(User.id, User.full_name, User.username).where(User.id.in_(teacher_ids))
    )
    teacher_names = {uid: (full_name or username) for uid, full_name, username in teachers_result.all()}

    course_ids = list({g["course_id"] for g in groups_by_id.values()})
    courses_result = await db.execute(select(Course.id, Course.title).where(Course.id.in_(course_ids)))
    course_titles = {cid: title for cid, title in courses_result.all()}

    for g in groups_by_id.values():
        g["teacher_name"] = teacher_names.get(g["teacher_id"])
        g["course_title"] = course_titles.get(g["course_id"])

    return groups_by_id


async def _compute_stats(db: AsyncSession, student_ids: list[int], group_ids: list[int]) -> dict[int, dict]:
    """Средний/макс балл + пропуски/опоздания по фактическим отметкам
    (LessonMark) в пределах заданных групп."""
    stats = {sid: {"scores": [], "unexcused": 0, "late": 0} for sid in student_ids}
    if not student_ids or not group_ids:
        return stats

    marks_result = await db.execute(
        select(LessonMark.student_id, LessonMark.score, LessonMark.attendance_status, LessonMark.is_late)
        .join(Lesson, Lesson.id == LessonMark.lesson_id)
        .where(Lesson.group_id.in_(group_ids), LessonMark.student_id.in_(student_ids))
    )
    for student_id, score, attendance_status, is_late in marks_result.all():
        row = stats[student_id]
        if score is not None:
            row["scores"].append(score)
        if attendance_status not in EXCUSED_OR_PRESENT:
            row["unexcused"] += 1
        if is_late:
            row["late"] += 1
    return stats


def _stats_summary(stats_row: dict) -> dict:
    scores = stats_row["scores"]
    return {
        "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
        "max_score": max(scores) if scores else None,
        "unexcused_absences": stats_row["unexcused"],
        "late_count": stats_row["late"],
    }


# Табличка «Студенты»: у teacher — только свои (через принадлежность к его
# группам), у admin — все по умолчанию, с возможностью сузить фильтрами.
@router.get("", response_model=list[StudentStatsOut])
async def list_students(
    course_id: Optional[int] = Query(None),
    group_id: Optional[int] = Query(None),
    teacher_id: Optional[int] = Query(None),  # фильтр «Препод» — учитывается только для admin
    mine: bool = Query(False),                # admin: считать только свои группы (кнопка «Моё»)
    sort: str = Query("name"),                # name | score
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    groups_by_id = await _scope_group_ids(db, current_user, course_id, group_id, teacher_id, mine)
    group_ids = list(groups_by_id.keys())
    if not group_ids:
        return []

    members_result = await db.execute(
        select(GroupMember.student_id, GroupMember.group_id)
        .where(GroupMember.group_id.in_(group_ids), GroupMember.status == "active")
    )
    student_ids = []
    student_groups = {}
    for student_id, gid in members_result.all():
        if student_id not in student_groups:
            student_groups[student_id] = []
            student_ids.append(student_id)
        student_groups[student_id].append(groups_by_id[gid])
    if not student_ids:
        return []

    users_result = await db.execute(
        select(User.id, User.full_name, User.username, User.telegram_username, User.whatsapp)
        .where(User.id.in_(student_ids))
    )
    users = {
        uid: {"full_name": full_name or username, "telegram_username": telegram_username, "whatsapp": whatsapp}
        for uid, full_name, username, telegram_username, whatsapp in users_result.all()
    }

    stats = await _compute_stats(db, student_ids, group_ids)

    out = []
    for sid in student_ids:
        u = users.get(sid, {"full_name": f"#{sid}", "telegram_username": None, "whatsapp": None})
        out.append(StudentStatsOut(
            id=sid,
            full_name=u["full_name"],
            telegram_username=u["telegram_username"],
            whatsapp=u["whatsapp"],
            groups=[StudentGroupOut(**{k: v for k, v in g.items() if k in ("id", "name", "teacher_id", "teacher_name")}) for g in student_groups[sid]],
            **_stats_summary(stats[sid]),
        ))

    if sort == "score":
        out.sort(key=lambda s: (s.avg_score is None, -(s.avg_score or 0)))
    else:
        out.sort(key=lambda s: s.full_name.lower())

    return out


TEMPLATE_PATH = Path(__file__).parent.parent.parent / "templates" / "student_card.html"


def render_student_card_html(lang: str, student: User, groups: list[dict], summary: dict) -> str:
    """Строит HTML карточки из статического шаблона (backend/templates/
    student_card.html). Шаблон переводится ДО подстановки данных — так же,
    как render_translated_template() в quizzes.py — потому что apply_to_html()
    умеет переводить только то, что autoi18n нашёл сканированием файлов на
    диске (backend/templates входит в scan_paths), и не видит текст,
    собранный на лету из f-строк. Имена/группы/цифры подставляются после
    перевода и никогда не переводятся."""
    with open(TEMPLATE_PATH, "r", encoding="utf-8") as f:
        template = f.read()

    if lang != translator.source_lang:
        try:
            template = translator.apply_to_html(template, lang)
        except Exception as e:
            print(f"❌ Ошибка перевода карточки студента: {e}")

    def contact_row(value: Optional[str]):
        return ("", value) if value else ("display:none", "")

    phone_display, phone_value = contact_row(student.phone)
    telegram_display, telegram_value = contact_row(student.telegram_username)
    whatsapp_display, whatsapp_value = contact_row(student.whatsapp)
    email_display, email_value = contact_row(student.email)

    groups_rows = "".join(
        f"<tr><td>{g['name']}</td><td>{g['course_title'] or '—'}</td><td>{g['teacher_name'] or '—'}</td></tr>"
        for g in groups
    )

    data = {
        "generated_date": datetime.now().strftime("%d.%m.%Y"),
        "student_name": student.full_name or student.username,
        "phone_display": phone_display,
        "phone_value": phone_value,
        "telegram_display": telegram_display,
        "telegram_value": telegram_value,
        "whatsapp_display": whatsapp_display,
        "whatsapp_value": whatsapp_value,
        "email_display": email_display,
        "email_value": email_value,
        "groups_rows": groups_rows,
        "empty_groups_display": "" if not groups else "display:none",
        "avg": summary["avg_score"] if summary["avg_score"] is not None else "—",
        "max_score": summary["max_score"] if summary["max_score"] is not None else "—",
        "unexcused": summary["unexcused_absences"],
        "late": summary["late_count"],
    }
    for key, value in data.items():
        template = template.replace(f"{{{{ {key} }}}}", str(value))

    return template


# PDF-карточка одного студента. teacher видит только своих (по своим
# группам), admin — любого зарегистрированного студента.
@router.get("/{student_id}/card")
async def get_student_card(
    student_id: int,
    lang: str = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher),
):
    lang = lang or translator.source_lang
    student_result = await db.execute(select(User).where(User.id == student_id, User.role == "student"))
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Студент не найден")

    # admin: все группы; teacher: только свои (без доп. фильтров) —
    # то же самое разграничение видимости, что и в списке /students.
    groups_by_id = await _scope_group_ids(db, current_user)

    member_result = await db.execute(
        select(GroupMember.group_id)
        .where(GroupMember.student_id == student_id, GroupMember.status == "active")
    )
    member_group_ids = {row[0] for row in member_result.all()}
    matched_group_ids = [gid for gid in member_group_ids if gid in groups_by_id]

    if current_user.role != "admin" and not matched_group_ids:
        raise HTTPException(status_code=403, detail="Этот студент не в ваших группах")

    stats = await _compute_stats(db, [student_id], matched_group_ids)
    summary = _stats_summary(stats[student_id])
    groups = [groups_by_id[gid] for gid in matched_group_ids]

    html = render_student_card_html(lang, student, groups, summary)

    buffer = io.BytesIO()
    pisa_status = pisa.CreatePDF(src=html, dest=buffer)
    if pisa_status.err:
        raise HTTPException(status_code=500, detail="Не удалось сформировать PDF")

    filename = f"student_{student_id}.pdf"
    return Response(
        content=buffer.getvalue(),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )
