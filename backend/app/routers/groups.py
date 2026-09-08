from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import Group, GroupMember, User, Course
from ..schemas import GroupOut, CourseOut
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


# Мои группы — группы привязанные к этому педагогу
@router.get("/my", response_model=list[GroupOut])
async def get_my_groups(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    if current_user.role == "admin":
        result = await db.execute(select(Group))
    else:
        result = await db.execute(
            select(Group).where(Group.teacher_id == current_user.id)
        )
    return result.scalars().all()


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