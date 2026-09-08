from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User, Group, GroupMember
from ..schemas import UserLogin, Token, UserOut, UserCreate, StudentRegister, UserUpdate
from ..core.security import verify_password, get_password_hash, create_access_token, decode_token
from ..dependencies import get_current_user

router = APIRouter()

# Регистрация педагога админом
@router.post("/register", response_model=UserOut)
async def register(
        user_data: UserCreate,
        db: AsyncSession = Depends(get_db),
        current_user: User = Depends(get_current_user)  # только admin
):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Только администратор")

    result = await db.execute(select(User).where(User.username == user_data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь уже существует")

    user = User(
        username=user_data.username,
        hashed_password=get_password_hash(user_data.password),
        email=user_data.email,
        role=user_data.role,
        created_by=current_user.id
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    # Ищем пользователя
    result = await db.execute(select(User).where(User.username == user_data.username))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")

    # Проверяем пароль
    if not verify_password(user_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Неверный пароль",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = create_access_token(data={"sub": user.username})
    return {"access_token": token}

@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/register/student", response_model=UserOut)
async def register_student(data: StudentRegister, db: AsyncSession = Depends(get_db)):
    # Проверяем invite_code
    result = await db.execute(select(Group).where(Group.invite_code == data.invite_code))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Группа не найдена")

    # Проверяем уникальность username
    result = await db.execute(select(User).where(User.username == data.username))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Пользователь уже существует")

    # Создаём студента
    student = User(
        username=data.username,
        hashed_password=get_password_hash(data.password),
        email=data.email,
        role="student"
    )
    db.add(student)
    await db.flush()  # получаем id до commit

    # Привязываем к группе
    member = GroupMember(group_id=group.id, student_id=student.id)
    db.add(member)
    await db.commit()
    await db.refresh(student)
    return student

@router.put("/me", response_model=UserOut)
async def update_me(
    data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if data.full_name is not None:        current_user.full_name = data.full_name
    if data.email is not None:            current_user.email = data.email
    if data.phone is not None:            current_user.phone = data.phone
    if data.telegram_username is not None: current_user.telegram_username = data.telegram_username
    if data.whatsapp is not None:         current_user.whatsapp = data.whatsapp
    if data.new_password:
        if not verify_password(data.old_password or '', current_user.hashed_password):
            raise HTTPException(status_code=400, detail="Неверный текущий пароль")
        current_user.hashed_password = get_password_hash(data.new_password)
    await db.commit()
    await db.refresh(current_user)
    return current_user