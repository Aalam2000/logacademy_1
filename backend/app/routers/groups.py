from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from ..database import get_db
from ..models import Group, GroupMember, User, Course
from ..schemas import GroupOut, CourseOut, GroupInviteOut
from ..dependencies import require_teacher

router = APIRouter(prefix="/groups", tags=["groups"])


# Список курсов — доступен teacher (и admin), read-only.
# Отдельно от /admin/courses, который остаётся только для admin.
@router.get("/courses", response_model=list[CourseOut])
async def get_courses_for_teacher(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    result = await db.execute(select(Course))
    return result.scalars().all()


# Мои группы — с количеством учеников и именем преподавателя.
# У admin, в отличие от teacher, есть выбор области видимости (тот же
# смысл, что и в /students — см. _scope_group_ids в students.py):
# teacher_id=<id> — группы конкретного препода, mine=true — только свои,
# ни то ни другое — вообще все группы.
@router.get("/my", response_model=list[GroupOut])
async def get_my_groups(
    teacher_id: Optional[int] = None,
    mine: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    query = select(Group)
    if current_user.role != "admin":
        query = query.where(Group.teacher_id == current_user.id)
    elif mine:
        query = query.where(Group.teacher_id == current_user.id)
    elif teacher_id is not None:
        query = query.where(Group.teacher_id == teacher_id)

    result = await db.execute(query)
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

    # Имена преподавателей
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

# Данные одной группы (teacher — только свою, admin — любую)
@router.get("/{group_id}", response_model=GroupOut)
async def get_group_detail(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    group_query = select(Group).where(Group.id == group_id)
    if current_user.role != "admin":
        group_query = group_query.where(Group.teacher_id == current_user.id)

    result = await db.execute(group_query)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    count_result = await db.execute(
        select(func.count(GroupMember.id))
        .where(GroupMember.group_id == group.id, GroupMember.status == "active")
    )
    student_count = count_result.scalar() or 0

    teacher_result = await db.execute(
        select(User.full_name, User.username).where(User.id == group.teacher_id)
    )
    row = teacher_result.first()
    teacher_name = (row[0] or row[1]) if row else None

    item = GroupOut.model_validate(group)
    item.student_count = student_count
    item.teacher_name = teacher_name
    return item

# Студенты группы — только активные
@router.get("/{group_id}/students")
async def get_group_students(
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
        select(User)
        .join(GroupMember, GroupMember.student_id == User.id)
        .where(GroupMember.group_id == group_id, GroupMember.status == "active")
    )
    return result.scalars().all()

# Публичный: данные группы по invite-коду (для страницы регистрации)
@router.get("/invite/{invite_code}", response_model=GroupInviteOut)
async def get_group_by_invite(
    invite_code: str,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Group).where(Group.invite_code == invite_code))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Приглашение недействительно")

    course_result = await db.execute(select(Course).where(Course.id == group.course_id))
    course = course_result.scalar_one_or_none()

    return GroupInviteOut(
        id=group.id,
        name=group.name,
        course_title=course.title if course else None
    )