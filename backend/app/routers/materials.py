import asyncio
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
from typing import Optional
from uuid import uuid4
from urllib.parse import quote

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File as FastAPIFile, Form
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from .. import storage
from ..database import get_db
from ..dependencies import require_admin, require_teacher, get_current_user
from ..models import Material, User, Lesson, LessonResource, GroupMember
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


async def _verify_student_material_access(
    db: AsyncSession, material_id: int, current_user: User
) -> None:
    """Студент может скачать/просмотреть файл, только если он реально
    привязан к открытому уроку в группе, где студент активный участник —
    иначе через прямой URL можно было бы утащить любой файл из общей
    базы знаний."""
    result = await db.execute(
        select(LessonResource)
        .join(Lesson, Lesson.id == LessonResource.lesson_id)
        .join(GroupMember, GroupMember.group_id == Lesson.group_id)
        .where(
            LessonResource.resource_type == "material",
            LessonResource.resource_id == material_id,
            Lesson.is_open == True,
            GroupMember.student_id == current_user.id,
            GroupMember.status == "active",
        )
    )
    if result.first() is None:
        raise HTTPException(status_code=403, detail="Нет доступа к файлу")


class MaterialOut(BaseModel):
    id: int
    original_filename: str
    content_type: Optional[str]
    size_bytes: int
    uploaded_by: int
    uploaded_by_name: Optional[str] = None
    created_at: datetime
    course_id: Optional[int] = None
    sector: Optional[str] = None
    template_lesson_no: Optional[str] = None
    template_status: Optional[str] = None

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


# Загрузка — доступна teacher и admin. Теги шаблона курса (course_id/
# sector/template_lesson_no) может проставить только admin — см.
# claude/course-templates-plan.md, раздел "Права". Обычный teacher их
# просто не передаёт (форма "+ Файл" их не показывает); если их всё же
# передал не-admin — 403, а не молчаливое игнорирование, чтобы не
# маскировать ошибку на фронте/в прямом вызове API.
@router.post("/upload", response_model=MaterialOut)
async def upload_material(
    file: UploadFile = FastAPIFile(...),
    course_id: Optional[int] = Form(None),
    sector: Optional[str] = Form(None),
    template_lesson_no: Optional[str] = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_teacher)
):
    if (course_id is not None or sector is not None or template_lesson_no is not None) \
            and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Теги шаблона курса может проставлять только администратор")

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
        course_id=course_id,
        sector=sector,
        template_lesson_no=template_lesson_no,
        # "Шаблонность" материала — заполненность course_id+sector+
        # template_lesson_no разом (см. course-templates-plan.md). Статус
        # выставляем в draft, только если номер урока реально указан —
        # файл, у которого проставлен только курс/сектор, но нет номера
        # урока, не становится "черновиком шаблона" сам по себе.
        template_status="draft" if template_lesson_no else None,
    )
    db.add(material)
    await db.commit()
    await db.refresh(material)

    item = MaterialOut.model_validate(material)
    item.uploaded_by_name = current_user.full_name or current_user.username
    return item


class MaterialTemplateUpdate(BaseModel):
    course_id: Optional[int] = None
    sector: Optional[str] = None
    template_lesson_no: Optional[str] = None
    template_status: Optional[str] = None  # draft | approved | rejected


class MaterialTemplateBulkUpdate(BaseModel):
    course_id: int
    sector: str
    template_status: str  # approved | rejected


# Правка тегов шаблона курса у уже загруженного файла — только admin.
# PATCH, а не отдельные ручки: обновляем только те поля, что реально
# прислали (exclude_unset), поэтому одиночное "одобрить"/"забраковать"
# ({"template_status": "..."}) не затирает course_id/sector/номер урока.
@router.patch("/{material_id}/template", response_model=MaterialOut)
async def update_material_template(
    material_id: int,
    data: MaterialTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(Material, User.full_name, User.username)
        .join(User, User.id == Material.uploaded_by)
        .where(Material.id == material_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Файл не найден")
    material, full_name, username = row

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(material, field, value)

    await db.commit()
    await db.refresh(material)

    item = MaterialOut.model_validate(material)
    item.uploaded_by_name = full_name or username
    return item


# Массовое решение по всему пакету материалов курса+сектора разом (см.
# claude/course-templates-plan.md) — меняет только template_status,
# сами course_id/sector/template_lesson_no не трогает.
@router.patch("/template/bulk")
async def bulk_update_material_template(
    data: MaterialTemplateBulkUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    result = await db.execute(
        select(Material).where(Material.course_id == data.course_id, Material.sector == data.sector)
    )
    materials = result.scalars().all()
    for material in materials:
        material.template_status = data.template_status
    await db.commit()
    return {"updated": len(materials)}


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
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Файл не найден")

    if current_user.role == "student":
        await _verify_student_material_access(db, material_id, current_user)
    elif current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Нет доступа")

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
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Material).where(Material.id == material_id))
    material = result.scalar_one_or_none()
    if not material:
        raise HTTPException(status_code=404, detail="Файл не найден")

    if current_user.role == "student":
        await _verify_student_material_access(db, material_id, current_user)
    elif current_user.role not in ("teacher", "admin"):
        raise HTTPException(status_code=403, detail="Нет доступа")

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
