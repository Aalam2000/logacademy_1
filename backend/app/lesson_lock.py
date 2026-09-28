"""Блокировка урока — в полночь дня урока по Баку (решение Андрея, 2026-09-25).

Единственное место, где задано это правило: им пользуются и роутер уроков
(что нельзя менять после полуночи), и подсчёт посещаемости (attendance.py —
урок без отметки «был» становится пропуском именно в момент блокировки).
"""
from datetime import datetime, time, timezone
from typing import Optional
from zoneinfo import ZoneInfo

BAKU_TZ = ZoneInfo("Asia/Baku")


def aware(value: datetime) -> datetime:
    """Дата без часового пояса считается UTC. PostgreSQL (timestamptz) всегда
    отдаёт с поясом — это страховка для других источников (SQLite в тестах)."""
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def lock_cutoff(now: Optional[datetime] = None) -> datetime:
    """Начало сегодняшнего дня по Баку: урок с датой раньше — заблокирован."""
    now_baku = (now or datetime.now(BAKU_TZ)).astimezone(BAKU_TZ)
    return datetime.combine(now_baku.date(), time.min, tzinfo=BAKU_TZ)


def is_date_locked(lesson_date: Optional[datetime]) -> bool:
    # Дата урока не задана — блокировать нечего.
    return lesson_date is not None and aware(lesson_date) < lock_cutoff()


def baku_day(value: datetime):
    return aware(value).astimezone(BAKU_TZ).date()
