"""Телефон пользователя: единый вид записи и запрет повторов.

Принимаем (пробелы, скобки и дефисы допускаются):
    +994 50 123 45 67   050 123 45 67      -> "+994501234567"  (Азербайджан)
    +7 916 037 15 37    8 916 037 15 37    -> "+79160371537"   (Россия)
    +90 532 123 45 67                      -> "+905321234567"  (любая страна — с «+» и кодом)
Местная запись без «+» понимается только для Азербайджана и России: для
остальных стран страну по ней не угадать. Номер в базе не повторяется ни у
кого (ученики, педагоги, админы) — сравниваем полный номер в едином виде.
"""
import re
from typing import Optional
from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from .models import User

PHONE_FORMAT_ERROR = "Введите номер с кодом страны, например +994 50 123 45 67"
PHONE_REQUIRED_ERROR = "Телефон обязателен"
PHONE_TAKEN_ERROR = "Этот телефон уже зарегистрирован. Войдите под своим логином или обратитесь к педагогу"


def normalize_phone(raw: Optional[str]) -> Optional[str]:
    """Номер в едином виде "+<код страны><номер>" или None, если запись не распознана."""
    s = re.sub(r"[\s\-()]", "", raw or "")
    if re.fullmatch(r"\+\d{8,15}", s):   # международная запись (E.164: до 15 цифр)
        return s
    if re.fullmatch(r"0\d{9}", s):        # Азербайджан: 050 123 45 67
        return "+994" + s[1:]
    if re.fullmatch(r"8\d{10}", s):       # Россия: 8 916 037 15 37
        return "+7" + s[1:]
    return None


def phone_key(raw: Optional[str]) -> Optional[str]:
    """Ключ сравнения: цифры номера в едином виде. Номера, записанные раньше
    как попало и не распознанные, сравниваются просто по своим цифрам."""
    digits = re.sub(r"\D", "", normalize_phone(raw) or raw or "")
    return digits or None


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
