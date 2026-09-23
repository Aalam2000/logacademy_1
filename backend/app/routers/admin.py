from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from pydantic import BaseModel
from typing import Optional
from ..database import get_db
from ..models import User, Course, Group, GroupMember, Lesson, LessonMark
from ..schemas import UserCreate, UserOut, CourseCreate, CourseOut, GroupCreate, GroupOut
from ..core.security import get_password_hash
from ..dependencies import require_admin
import secrets

router = APIRouter(prefix="/admin", tags=["admin"])


class GroupUpdate(BaseModel):
    name: str
    course_id: int
    teacher_id: int
    telegram_chat_id: Optional[str] = None
    whatsapp: Optional[str] = None
    sector: Optional[str] = None  # 'ru' | 'az' — см. course-templates-plan.md

class UserAdminUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    telegram_username: Optional[str] = None
    whatsapp: Optional[str] = None

class CourseUpdate(BaseModel):
    title: str
    description: Optional[str] = None

# ── ПЕДАГОГИ ──

@router.get("/teachers", response_model=list[UserOut])
async def get_teachers(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.role == "teacher"))
    return result.scalars().all()

@router.post("/teachers", response_model=UserOut)
async def create_teacher(data: UserCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    user = User(
        username=data.username,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        telegram_username=data.telegram_username,
        whatsapp=data.whatsapp,
        role="teacher",
        created_by=admin.id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.patch("/teachers/{user_id}", response_model=UserOut)
async def update_teacher(
    user_id: int,
    data: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    result = await db.execute(select(User).where(User.id == user_id, User.role == "teacher"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Педагог не найден")
    user.full_name = data.full_name
    user.email = data.email
    user.phone = data.phone
    user.telegram_username = data.telegram_username
    user.whatsapp = data.whatsapp
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/teachers/{user_id}")
async def delete_teacher(user_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id, User.role == "teacher"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Педагог не найден")
    # Проверяем — есть ли группы у этого педагога
    groups = await db.execute(select(Group).where(Group.teacher_id == user_id))
    if groups.scalars().first():
        raise HTTPException(status_code=400, detail="Нельзя удалить — у педагога есть группы")
    await db.delete(user)
    await db.commit()
    return {"detail": "Удалён"}

class TeacherStatsOut(BaseModel):
    id: int
    full_name: str
    group_count: int
    student_count: int
    attendance_pct: Optional[float] = None
    avg_score: Optional[float] = None


# Справочник преподов: по каждому — кол-во активных групп, уникальных
# активных студентов, % посещаемости и средний балл по всем его ученикам.
# Считаются все, кто фигурирует как teacher_id хотя бы одной активной
# группы (это может быть и admin — модель это разрешает), а не только
# пользователи с role="teacher".
@router.get("/teachers/directory", response_model=list[TeacherStatsOut])
async def get_teachers_directory(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    groups_result = await db.execute(
        select(Group.id, Group.teacher_id).where(Group.status == "active")
    )
    groups_by_teacher: dict[int, list[int]] = {}
    all_group_ids: list[int] = []
    for gid, tid in groups_result.all():
        groups_by_teacher.setdefault(tid, []).append(gid)
        all_group_ids.append(gid)

    if not groups_by_teacher:
        return []

    teacher_ids = list(groups_by_teacher.keys())
    users_result = await db.execute(
        select(User.id, User.full_name, User.username).where(User.id.in_(teacher_ids))
    )
    names = {uid: (full_name or username) for uid, full_name, username in users_result.all()}

    members_result = await db.execute(
        select(GroupMember.group_id, GroupMember.student_id)
        .where(GroupMember.group_id.in_(all_group_ids), GroupMember.status == "active")
    )
    students_by_group: dict[int, set[int]] = {}
    for gid, sid in members_result.all():
        students_by_group.setdefault(gid, set()).add(sid)

    marks_result = await db.execute(
        select(Lesson.group_id, LessonMark.score, LessonMark.attendance_status)
        .join(Lesson, Lesson.id == LessonMark.lesson_id)
        .where(Lesson.group_id.in_(all_group_ids))
    )
    marks_by_group: dict[int, list] = {}
    for gid, score, attendance_status in marks_result.all():
        marks_by_group.setdefault(gid, []).append((score, attendance_status))

    out = []
    for tid, gids in groups_by_teacher.items():
        student_ids: set[int] = set()
        scores: list[int] = []
        present = 0
        counted = 0
        for gid in gids:
            student_ids |= students_by_group.get(gid, set())
            for score, attendance_status in marks_by_group.get(gid, []):
                if score is not None:
                    scores.append(score)
                # excused и NULL (нет отметки) не портят статистику — не
                # считаются вообще, ни в числитель, ни в знаменатель.
                if attendance_status in ("in_person", "online"):
                    present += 1
                    counted += 1
                elif attendance_status == "absent":
                    counted += 1

        out.append(TeacherStatsOut(
            id=tid,
            full_name=names.get(tid, f"#{tid}"),
            group_count=len(gids),
            student_count=len(student_ids),
            attendance_pct=round(present / counted * 100, 1) if counted else None,
            avg_score=round(sum(scores) / len(scores), 1) if scores else None,
        ))

    out.sort(key=lambda t: t.full_name.lower())
    return out


# ── АДМИНЫ ──

@router.get("/admins", response_model=list[UserOut])
async def get_admins(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.role == "admin"))
    return result.scalars().all()

@router.post("/admins", response_model=UserOut)
async def create_admin(data: UserCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь уже существует")
    user = User(
        username=data.username,
        hashed_password=get_password_hash(data.password),
        full_name=data.full_name,
        email=data.email,
        phone=data.phone,
        telegram_username=data.telegram_username,
        whatsapp=data.whatsapp,
        role="admin",
        created_by=admin.id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.patch("/admins/{user_id}", response_model=UserOut)
async def update_admin(
    user_id: int,
    data: UserAdminUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    result = await db.execute(select(User).where(User.id == user_id, User.role == "admin"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Админ не найден")
    user.full_name = data.full_name
    user.email = data.email
    user.phone = data.phone
    user.telegram_username = data.telegram_username
    user.whatsapp = data.whatsapp
    await db.commit()
    await db.refresh(user)
    return user

@router.delete("/admins/{user_id}")
async def delete_admin(user_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(User).where(User.id == user_id, User.role == "admin"))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Админ не найден")
    await db.delete(user)
    await db.commit()
    return {"detail": "Удалён"}

# ── КУРСЫ ──

@router.get("/courses", response_model=list[CourseOut])
async def get_courses(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(Course))
    return result.scalars().all()

@router.post("/courses", response_model=CourseOut)
async def create_course(data: CourseCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    course = Course(title=data.title, description=data.description)
    db.add(course)
    await db.commit()
    await db.refresh(course)
    return course

@router.patch("/courses/{course_id}", response_model=CourseOut)
async def update_course(
    course_id: int,
    data: CourseUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    course.title = data.title
    course.description = data.description
    await db.commit()
    await db.refresh(course)
    return course

@router.delete("/courses/{course_id}")
async def delete_course(course_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(Course).where(Course.id == course_id))
    course = result.scalar_one_or_none()
    if not course:
        raise HTTPException(status_code=404, detail="Курс не найден")
    # Проверяем — есть ли группы с этим курсом
    groups = await db.execute(select(Group).where(Group.course_id == course_id))
    if groups.scalars().first():
        raise HTTPException(status_code=400, detail="Нельзя удалить — курс используется в группах")
    await db.delete(course)
    await db.commit()
    return {"detail": "Удалён"}

# ── ГРУППЫ ──

@router.get("/groups", response_model=list[GroupOut])
async def get_groups(db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(Group))
    groups = result.scalars().all()
    if not groups:
        return []

    group_ids = [g.id for g in groups]

    # Количество активных учеников по группам
    counts_result = await db.execute(
        select(GroupMember.group_id, func.count(GroupMember.id))
        .where(GroupMember.group_id.in_(group_ids), GroupMember.status == "active")
        .group_by(GroupMember.group_id)
    )
    counts = {gid: cnt for gid, cnt in counts_result.all()}

    # Имена преподавателей — раньше не подставлялись вообще (в отличие от
    # /groups/my), из-за чего в StudentsPage фильтр «Препод» показывал
    # «#<id>» вместо имени.
    teacher_ids = list({g.teacher_id for g in groups})
    teachers_result = await db.execute(
        select(User.id, User.full_name, User.username).where(User.id.in_(teacher_ids))
    )
    teachers = {uid: (full_name or username) for uid, full_name, username in teachers_result.all()}

    out = []
    for g in groups:
        item = GroupOut.model_validate(g)
        item.student_count = counts.get(g.id, 0)
        item.teacher_name = teachers.get(g.teacher_id)
        out.append(item)
    return out

@router.post("/groups", response_model=GroupOut)
async def create_group(data: GroupCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    teacher_result = await db.execute(
        select(User).where(User.id == data.teacher_id, User.role.in_(["teacher", "admin"]))
    )
    if not teacher_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Выберите корректного педагога")

    invite_code = secrets.token_urlsafe(8)
    group = Group(
        name=data.name,
        course_id=data.course_id,
        teacher_id=data.teacher_id,
        invite_code=invite_code,
        telegram_chat_id=data.telegram_chat_id,
        whatsapp=data.whatsapp,
        sector=data.sector
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group


@router.patch("/groups/{group_id}", response_model=GroupOut)
async def update_group(
    group_id: int,
    data: GroupUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin)
):
    group_result = await db.execute(select(Group).where(Group.id == group_id))
    group = group_result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    teacher_result = await db.execute(
        select(User).where(User.id == data.teacher_id, User.role.in_(["teacher", "admin"]))
    )
    if not teacher_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Выберите корректного педагога")

    course_result = await db.execute(select(Course).where(Course.id == data.course_id))
    if not course_result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Выберите корректный курс")

    group.name = data.name
    group.course_id = data.course_id
    group.teacher_id = data.teacher_id
    group.telegram_chat_id = data.telegram_chat_id
    group.whatsapp = data.whatsapp
    group.sector = data.sector
    await db.commit()
    await db.refresh(group)
    return group

@router.delete("/groups/{group_id}")
async def delete_group(group_id: int, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")
    # Проверяем студентов
    members = await db.execute(select(GroupMember).where(GroupMember.group_id == group_id))
    if members.scalars().first():
        raise HTTPException(status_code=400, detail="Нельзя удалить — в группе есть студенты")
    # Проверяем уроки
    lessons = await db.execute(select(Lesson).where(Lesson.group_id == group_id))
    if lessons.scalars().first():
        raise HTTPException(status_code=400, detail="Нельзя удалить — в группе есть уроки")
    await db.delete(group)
    await db.commit()
    return {"detail": "Удалена"}