import asyncio
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile
from fastapi.responses import Response, StreamingResponse
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

# Форматы, для которых делаем предпросмотр через конвертацию в PDF
# (см. /materials/{id}/preview ниже). Конвертация всегда заново, без
# кэша — решение Андрея, 2026-09-18; следующий шаг (редактирование
# этих файлов) — отдельная, ещё не спроектированная задача.
PREVIEW_CONVERTIBLE_EXTENSIONS = {".docx", ".xlsx", ".pptx"}


def _fetch_and_convert_to_pdf(object_key: str, ext: str) -> bytes:
    """Синхронная (блокирующая) часть — скачивание из MinIO и вызов
    soffice — намеренно вынесена в отдельную функцию и гоняется через
    asyncio.to_thread в самом эндпоинте, чтобы не блокировать event loop."""
    data = b"".join(storage.stream_object(object_key))
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / f"src{ext}"
        src.write_bytes(data)
        subprocess.run(
            ["soffice", "--headless", "--convert-to", "pdf", "--outdir", tmp, str(src)],
            check=True, timeout=60, capture_output=True,
        )
        return src.with_suffix(".pdf").read_bytes()


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


def _content_disposition(filename: str, disposition: str = "attachment") -> str:
    """Имя файла может быть не-ASCII (кириллица/azeri) — HTTP-заголовки
    кодируются в latin-1, поэтому кладём его только в filename* (RFC 5987,
    UTF-8 + percent-encoding), а filename оставляем ASCII-заглушкой для
    старых клиентов."""
    ascii_fallback = filename.encode("ascii", "ignore").decode("ascii") or "file"
    quoted = quote(filename)
    return f"{disposition}; filename=\"{ascii_fallback}\"; filename*=UTF-8''{quoted}"


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
        headers={"Content-Disposition": _content_disposition(material.original_filename)},
    )


# Предпросмотр — docx/xlsx/pptx конвертируются в PDF на лету и открываются
# в браузере тем же путём, что уже работает для PDF/картинок (см.
# handleOpen/handleOpenItem на фронте). Без кэша: конвертируем заново на
# каждый запрос.
@router.get("/{material_id}/preview")
async def preview_material(
    material_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Файл не найден")

    ext = Path(material.original_filename).suffix.lower()
    if ext not in PREVIEW_CONVERTIBLE_EXTENSIONS:
        raise HTTPException(status_code=400, detail="Предпросмотр для этого формата не поддерживается")

    try:
        pdf_bytes = await asyncio.to_thread(_fetch_and_convert_to_pdf, material.object_key, ext)
    except subprocess.CalledProcessError:
        raise HTTPException(status_code=500, detail="Не удалось сконвертировать файл в PDF")
    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Конвертация заняла слишком много времени")

    return Response(content=pdf_bytes, media_type="application/pdf")


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
