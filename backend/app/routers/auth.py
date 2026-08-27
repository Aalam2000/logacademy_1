from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from ..database import get_db
from ..models import User
from ..schemas import UserLogin, Token, UserOut
from ..core.security import verify_password, get_password_hash, create_access_token, decode_token
from ..dependencies import get_current_user

router = APIRouter()

@router.post("/login", response_model=Token)
async def login(user_data: UserLogin, db: AsyncSession = Depends(get_db)):
    # Ищем пользователя
    result = await db.execute(select(User).where(User.username == user_data.username))
    user = result.scalar_one_or_none()

    if not user:
        # Создаём нового пользователя
        hashed = get_password_hash(user_data.password)
        new_user = User(username=user_data.username, hashed_password=hashed)
        db.add(new_user)
        await db.commit()
        await db.refresh(new_user)
        token = create_access_token(data={"sub": new_user.username})
        return {"access_token": token}

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