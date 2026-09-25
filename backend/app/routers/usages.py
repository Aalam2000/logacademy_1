"""GET /usages/{entity}/{id} — где используется объект (см. app/usages.py).
Нужен общей кнопке удаления на фронте (components/DeleteButton.js)."""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import get_current_user
from ..models import User
from ..usages import check_access, find_usages

router = APIRouter(prefix="/usages", tags=["usages"])


@router.get("/{entity}/{entity_id}")
async def get_usages(
    entity: str,
    entity_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    check_access(entity, current_user.role)
    # Себя удалить нельзя в принципе — сообщаем сразу, до списка мест
    if entity == "user" and entity_id == current_user.id:
        raise HTTPException(status_code=400, detail="Нельзя удалить самого себя")
    return {"usages": await find_usages(db, entity, entity_id)}
