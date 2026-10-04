"""Телефон ученика: азербайджанский стандарт и запрет повторов.

Принимаем два вида записи (пробелы, скобки и дефисы допускаются):
    +994 50 123 45 67      050 123 45 67
В базе оба хранятся одинаково — "+994501234567". Номер в базе не повторяется
ни у кого (ученики, педагоги, админы): повтор сравнивается по последним
9 цифрам, чтобы совпадали и номера, записанные раньше в произвольном виде.
"""
import re
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import User

PHONE_FORMAT_ERROR = "Введите номер в формате +994 50 123 45 67 или 050 123 45 67"
PHONE_REQUIRED_ERROR = "Телефон обязателен"
PHONE_TAKEN_ERROR = "Этот телефон уже зарегистрирован. Войдите под своим логином или обратитесь к педагогу"


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """"+994501234567" или None, если номер не в азербайджанском формате."""
    s = re.sub(r"[\s\-()]", "", raw or "")
    if re.fullmatch(r"\+994\d{9}", s):
        return s
    if re.fullmatch(r"0\d{9}", s):
        return "+994" + s[1:]
    return None


def phone_key(raw: Optional[str]) -> Optional[str]:
    """Последние 9 цифр — ключ сравнения (для номеров в любом виде записи)."""
    digits = re.sub(r"\D", "", raw or "")
    return digits[-9:] if len(digits) >= 9 else None


async def ensure_phone_free(db: AsyncSession, raw: Optional[str], exclude_user_id: Optional[int] = None) -> None:
    """409, если этот номер уже есть у любого другого пользователя. Пустой номер не проверяется."""
    key = phone_key(raw)
    if not key:
        return
    result = await db.execute(select(User.id, User.phone).where(User.phone.isnot(None)))
    for uid, other in result.all():
        if uid != exclude_user_id and phone_key(other) == key:
            raise HTTPException(status_code=409, detail=PHONE_TAKEN_ERROR)


async def checked_student_phone(db: AsyncSession, raw: Optional[str], exclude_user_id: Optional[int] = None) -> str:
    """Телефон ученика: нормализует и проверяет, что номера нет в базе.
    422 — неверный формат, 409 — телефон уже зарегистрирован."""
    phone = normalize_phone(raw)
    if not phone:
        raise HTTPException(status_code=422, detail=PHONE_FORMAT_ERROR)
    await ensure_phone_free(db, phone, exclude_user_id)
    return phone
