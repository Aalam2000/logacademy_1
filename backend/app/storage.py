"""
Обёртка над MinIO-клиентом — единая точка входа для загрузки/скачивания/
удаления файлов. Читает те же переменные окружения, что уже прописаны в
.env.dev/.env.prod (MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY/BUCKET/SECURE) —
код не знает и не должен знать, MinIO это контейнер (dev) или системный
сервис с хранением на диске (prod), см. claude/minio-plan.md.
"""
import io
import os

from minio import Minio
from minio.error import S3Error

MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "minio:9000")
MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
MINIO_BUCKET = os.getenv("MINIO_BUCKET", "logacademy")
MINIO_SECURE = os.getenv("MINIO_SECURE", "false").lower() == "true"

_client = Minio(
    MINIO_ENDPOINT,
    access_key=MINIO_ACCESS_KEY,
    secret_key=MINIO_SECRET_KEY,
    secure=MINIO_SECURE,
)


def ensure_bucket() -> None:
    if not _client.bucket_exists(MINIO_BUCKET):
        _client.make_bucket(MINIO_BUCKET)


def upload_bytes(object_key: str, data: bytes, content_type: str | None) -> None:
    ensure_bucket()
    _client.put_object(
        MINIO_BUCKET,
        object_key,
        io.BytesIO(data),
        length=len(data),
        content_type=content_type or "application/octet-stream",
    )


def stream_object(object_key: str, chunk_size: int = 32 * 1024):
    resp = _client.get_object(MINIO_BUCKET, object_key)
    try:
        for chunk in resp.stream(chunk_size):
            yield chunk
    finally:
        resp.close()
        resp.release_conn()


def read_object_or_none(object_key: str) -> bytes | None:
    """Файл целиком или None, если такого ключа нет (для кэша предпросмотра)."""
    try:
        return b"".join(stream_object(object_key))
    except S3Error as e:
        if e.code in ("NoSuchKey", "NoSuchBucket"):
            return None
        raise


# Кэш PDF-предпросмотра docx/xlsx/pptx (materials.py). object_key файла
# уникален и никогда не перезаписывается (новая загрузка = новый ключ),
# поэтому PDF, привязанный к ключу, не устаревает.
def preview_key(object_key: str) -> str:
    return f"previews/{object_key}.pdf"


def delete_object(object_key: str) -> None:
    _client.remove_object(MINIO_BUCKET, object_key)
    # Вместе с файлом — его PDF-предпросмотр, если был (remove_object
    # несуществующего ключа в MinIO/S3 не ошибка)
    if not object_key.startswith("previews/"):
        _client.remove_object(MINIO_BUCKET, preview_key(object_key))
