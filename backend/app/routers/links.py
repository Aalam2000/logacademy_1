from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_db
from ..dependencies import require_admin, require_teacher
from ..models import Link, User
from ..resources import find_duplicate_link, conflict
from ..usages import ensure_not_used

router = APIRouter(prefix="/links", tags=["links"])


class LinkCreate(BaseModel):
    url: str
    title: str
    description: Optional[str] = None


class LinkOut(BaseModel):
    id: int
    url: str
    title: str
    description: Optional[str]
    added_by: int
    added_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Библиотека ссылок — доступна teacher и admin, как и «База знаний» файлов
@router.get("/", response_model=list[LinkOut])
async def list_links(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    result = await db.execute(
        select(Link, User.full_name, User.username)
        .join(User, User.id == Link.added_by)
        .order_by(Link.created_at.desc())
    )
    out = []
    for link, full_name, username in result.all():
        item = LinkOut.model_validate(link)
        item.added_by_name = full_name or username
        out.append(item)
    return out


# Добавление — доступно teacher и admin
@router.post("/", response_model=LinkOut)
async def create_link(
    data: LinkCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    # Та же ссылка (адрес после нормализации) второй раз не создаётся
    duplicate = await find_duplicate_link(db, data.url)
    if duplicate:
        existing, who = duplicate
        return conflict("duplicate", f"Такая ссылка уже есть в Базе знаний: «{existing.title}» ({who})", existing.id)

    link = Link(
        url=data.url.strip(),
        title=data.title,
        description=data.description,
        added_by=current_user.id,
        created_at=datetime.now(timezone.utc),
    )
    db.add(link)
    await db.commit()
    await db.refresh(link)

    item = LinkOut.model_validate(link)
    item.added_by_name = current_user.full_name or current_user.username
    return item


# Удаление — только admin (как у файлов), и только если нигде не привязана
@router.delete("/{link_id}")
async def delete_link(
    link_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(Link).where(Link.id == link_id))
    link = result.scalar_one_or_none()
    if not link:
        raise HTTPException(status_code=404, detail="Ссылка не найдена")

    await ensure_not_used(db, "link", link_id)

    await db.delete(link)
    await db.commit()
    return {"ok": True}
