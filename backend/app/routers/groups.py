from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from ..database import get_db
from ..models import Group, GroupMember, User, Course
from ..schemas import GroupOut, CourseOut, GroupInviteOut
from ..dependencies import require_teacher

router = APIRouter(prefix="/groups", tags=["groups"])


# Общая проверка доступа к группе: admin — к любой, teacher — только к
# своей. Раньше дублировалась в каждом эндпоинте отдельным select'ом —
# вынесена сюда, т.к. с добавлением эндпоинтов по участникам группы
# (members/expel/restore/available-students) дублей стало бы 6+.
async def _get_owned_group(db: AsyncSession, group_id: int, current_user: User) -> Group:
    query = select(Group).where(Group.id == group_id)
    if current_user.role != "admin":
        query = query.where(Group.teacher_id == current_user.id)
    result = await db.execute(query)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=403, detail="Нет доступа к этой группе")
    return group


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

class GroupMemberOut(BaseModel):
    id: int  # id ученика (User.id) — как и раньше, фронт ждёт это поле
    full_name: Optional[str] = None
    username: str
    created_at: datetime
    membership_id: int  # id самой записи group_members — нужен для expel/restore
    status: str
    expel_reason: Optional[str] = None
    expelled_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AddMemberIn(BaseModel):
    student_id: int


class ExpelMemberIn(BaseModel):
    reason: str


# Участники группы — по умолчанию активные, ?status=expelled — архив
# (отчисленные, с причиной и датой).
@router.get("/{group_id}/students", response_model=list[GroupMemberOut])
async def get_group_students(
    group_id: int,
    status: str = "active",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    if status not in ("active", "expelled"):
        raise HTTPException(status_code=400, detail="status должен быть active или expelled")
    await _get_owned_group(db, group_id, current_user)

    result = await db.execute(
        select(User, GroupMember)
        .join(GroupMember, GroupMember.student_id == User.id)
        .where(GroupMember.group_id == group_id, GroupMember.status == status)
        .order_by(User.full_name, User.username)
    )
    out = []
    for user, member in result.all():
        out.append(GroupMemberOut(
            id=user.id,
            full_name=user.full_name,
            username=user.username,
            created_at=user.created_at,
            membership_id=member.id,
            status=member.status,
            expel_reason=member.expel_reason,
            expelled_at=member.expelled_at,
        ))
    return out


# Поиск учеников для добавления в группу — по имени/логину, исключая тех,
# кто уже состоит в ней активно (повторно отчисленного добавить можно —
# POST /members сам поймёт, что это восстановление, см. ниже).
@router.get("/{group_id}/available-students", response_model=list[GroupMemberOut])
async def search_available_students(
    group_id: int,
    q: str = "",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await _get_owned_group(db, group_id, current_user)

    already_active = select(GroupMember.student_id).where(
        GroupMember.group_id == group_id, GroupMember.status == "active"
    )
    query = select(User).where(User.role == "student", User.id.notin_(already_active))
    q = q.strip()
    if q:
        like = f"%{q}%"
        query = query.where(or_(User.full_name.ilike(like), User.username.ilike(like)))
    query = query.order_by(User.full_name, User.username).limit(20)

    result = await db.execute(query)
    out = []
    for user in result.scalars().all():
        out.append(GroupMemberOut(
            id=user.id, full_name=user.full_name, username=user.username,
            created_at=user.created_at, membership_id=0, status="",
        ))
    return out


# Добавить существующего ученика в группу (не через инвайт-код — тот
# создаёт НОВОГО пользователя, тут ученик уже есть). Если он уже был в
# этой группе и отчислен — это восстановление того же членства, а не
# новая запись (иначе задвоили бы историю group_members на одного и того
# же ученика в одной группе).
@router.post("/{group_id}/members", response_model=GroupMemberOut)
async def add_group_member(
    group_id: int,
    data: AddMemberIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await _get_owned_group(db, group_id, current_user)

    student_result = await db.execute(
        select(User).where(User.id == data.student_id, User.role == "student")
    )
    student = student_result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Ученик не найден")

    existing_result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.student_id == data.student_id
        )
    )
    member = existing_result.scalar_one_or_none()
    if member and member.status == "active":
        raise HTTPException(status_code=400, detail="Ученик уже в этой группе")

    if member:
        member.status = "active"
        member.expel_reason = None
        member.expelled_at = None
        member.expelled_by = None
    else:
        member = GroupMember(group_id=group_id, student_id=data.student_id, status="active")
        db.add(member)

    await db.commit()
    await db.refresh(member)
    return GroupMemberOut(
        id=student.id, full_name=student.full_name, username=student.username,
        created_at=student.created_at, membership_id=member.id, status=member.status,
    )


# Отчислить из ЭТОЙ группы — комментарий обязателен (не молчаливое
# "куда-то делся", а видимая причина: не оплатил, закончил курс и т.д.).
# Ученик остаётся активным в других своих группах, если они есть.
@router.post("/{group_id}/members/{student_id}/expel", response_model=GroupMemberOut)
async def expel_group_member(
    group_id: int,
    student_id: int,
    data: ExpelMemberIn,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await _get_owned_group(db, group_id, current_user)

    reason = data.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="Укажите причину отчисления")

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.student_id == student_id,
            GroupMember.status == "active",
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Ученик не найден среди активных участников группы")

    member.status = "expelled"
    member.expel_reason = reason
    member.expelled_at = datetime.now(timezone.utc)
    member.expelled_by = current_user.id
    await db.commit()

    student_result = await db.execute(select(User).where(User.id == student_id))
    student = student_result.scalar_one()
    return GroupMemberOut(
        id=student.id, full_name=student.full_name, username=student.username,
        created_at=student.created_at, membership_id=member.id, status=member.status,
        expel_reason=member.expel_reason, expelled_at=member.expelled_at,
    )


# Вернуть из архива — ученик мог пропустить месяц (за неуплату и т.п.) и
# вернуться; причину/дату отчисления не храним, "чистое" восстановление.
@router.post("/{group_id}/members/{student_id}/restore", response_model=GroupMemberOut)
async def restore_group_member(
    group_id: int,
    student_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    await _get_owned_group(db, group_id, current_user)

    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id,
            GroupMember.student_id == student_id,
            GroupMember.status == "expelled",
        )
    )
    member = result.scalar_one_or_none()
    if not member:
        raise HTTPException(status_code=404, detail="Ученик не найден в архиве этой группы")

    member.status = "active"
    member.expel_reason = None
    member.expelled_at = None
    member.expelled_by = None
    await db.commit()

    student_result = await db.execute(select(User).where(User.id == student_id))
    student = student_result.scalar_one()
    return GroupMemberOut(
        id=student.id, full_name=student.full_name, username=student.username,
        created_at=student.created_at, membership_id=member.id, status=member.status,
    )

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