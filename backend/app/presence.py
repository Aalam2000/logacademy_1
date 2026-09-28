"""Присутствие пользователей в системе (claude/presence-plan.md).

Единственное место правил: кто «сейчас в системе», как склеиваются сессии
и как считается время. Им пользуются роутер presence.py (пульс, онлайн,
отчёт) и больше никто.

- Открытая и видимая вкладка шлёт пульс раз в PING_INTERVAL (фронт:
  hooks/usePresencePing.js). Свёрнутая / скрытая вкладка пульс не шлёт.
- Пульс продлевает последнюю сессию, если с прошлого прошло не больше
  SESSION_GAP; иначе начинается новая сессия.
- «Сегодня в системе» — все, у кого сегодня (по Баку) была сессия; зелёный
  флажок «сейчас здесь» — последний пульс не старше ONLINE_WINDOW.
- Время сессии = last_seen - started + PING_INTERVAL (последняя минута
  после последнего пульса тоже была проведена в системе).
"""
from datetime import datetime, timedelta, timezone

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from .lesson_lock import aware
from .models import UserSession

PING_INTERVAL = timedelta(seconds=60)
SESSION_GAP = timedelta(minutes=5)
ONLINE_WINDOW = timedelta(minutes=10)  # решение Андрея: «сейчас здесь» = активен за 10 мин
# Несколько вкладок одного пользователя шлют пульсы независимо — чаще раза
# в THROTTLE базу не трогаем.
THROTTLE = timedelta(seconds=20)
RETENTION_DAYS = 365


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


def session_minutes(started_at: datetime, last_seen_at: datetime) -> float:
    return ((last_seen_at - started_at) + PING_INTERVAL).total_seconds() / 60


async def record_ping(db: AsyncSession, user_id: int) -> None:
    now = now_utc()
    last = (await db.execute(
        select(UserSession)
        .where(UserSession.user_id == user_id)
        .order_by(UserSession.last_seen_at.desc())
        .limit(1)
    )).scalar_one_or_none()
    last_seen = aware(last.last_seen_at) if last else None
    if last_seen and last_seen >= now - THROTTLE:
        return
    if last_seen and last_seen >= now - SESSION_GAP:
        last.last_seen_at = now
    else:
        db.add(UserSession(user_id=user_id, started_at=now, last_seen_at=now))
    await db.commit()


async def purge_old(db: AsyncSession) -> None:
    """Срок хранения: сессии старше RETENTION_DAYS удаляются (вызывается из отчёта)."""
    await db.execute(delete(UserSession).where(
        UserSession.last_seen_at < now_utc() - timedelta(days=RETENTION_DAYS)
    ))
    await db.commit()
