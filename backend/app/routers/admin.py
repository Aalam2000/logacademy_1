from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Course, Group, GroupMember, Lesson
from ..schemas import UserCreate, UserOut, CourseCreate, CourseOut, GroupCreate, GroupOut
from ..core.security import get_password_hash
from ..dependencies import require_admin
import secrets

router = APIRouter(prefix="/admin", tags=["admin"])

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
    course = Course(title=data.title)
    db.add(course)
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
    return result.scalars().all()

@router.post("/groups", response_model=GroupOut)
async def create_group(data: GroupCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(require_admin)):
    invite_code = secrets.token_urlsafe(8)
    group = Group(
        name=data.name,
        course_id=data.course_id,
        teacher_id=data.teacher_id,
        invite_code=invite_code,
        telegram_chat_id=data.telegram_chat_id
    )
    db.add(group)
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