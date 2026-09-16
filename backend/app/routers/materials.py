from datetime import datetime
from typing import Optional
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import storage
from ..database import get_db
from ..dependencies import require_admin, require_teacher
from ..models import Material, User
from ..resources import ensure_deletable

router = APIRouter(prefix="/materials", tags=["materials"])

MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 МБ — рабочий дефолт, см. claude/minio-plan.md


class MaterialOut(BaseModel):
    id: int
    original_filename: str
    content_type: Optional[str]
    size_bytes: int
    uploaded_by: int
    uploaded_by_name: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# Библиотека материалов — доступна teacher и admin (require_teacher пускает обоих)
@router.get("/", response_model=list[MaterialOut])
async def list_materials(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    result = await db.execute(
        select(Material, User.full_name, User.username)
        .join(User, User.id == Material.uploaded_by)
        .order_by(Material.created_at.desc())
    )
    out = []
    for material, full_name, username in result.all():
        item = MaterialOut.model_validate(material)
        item.uploaded_by_name = full_name or username
        out.append(item)
    return out


# Загрузка — доступна teacher и admin
@router.post("/upload", response_model=MaterialOut)
async def upload_material(
    file: UploadFile = FastAPIFile(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    contents = await file.read()
    size_bytes = len(contents)
    if size_bytes == 0:
        raise HTTPException(status_code=400, detail="Пустой файл")
    if size_bytes > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="Файл слишком большой (максимум 50 МБ)")

    object_key = f"materials/{uuid4()}/{file.filename}"
    storage.upload_bytes(object_key, contents, file.content_type)

    material = Material(
        object_key=object_key,
        original_filename=file.filename,
        content_type=file.content_type,
        size_bytes=size_bytes,
        uploaded_by=current_user.id,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)

    item = MaterialOut.model_validate(material)
    item.uploaded_by_name = current_user.full_name or current_user.username
    return item


# Скачивание — стримим через бэкенд (см. claude/minio-plan.md, п.3)
@router.get("/{material_id}/download")
async def download_material(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Файл не найден")

    return StreamingResponse(
        storage.stream_object(material.object_key),
        media_type=material.content_type or "application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{material.original_filename}"'},
    )


# Удаление — только admin
@router.delete("/{material_id}")
async def delete_material(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Файл не найден")

    await ensure_deletable(db, "material", material_id)

    storage.delete_object(material.object_key)
    await db.delete(material)
    await db.commit()
    return {"ok": True}
