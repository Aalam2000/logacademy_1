"""Общее для отчётов по педагогу и по ученику (teacher_report.py, student_report.py):
месяц отчёта, оценка показателя по норме и общий вывод по набору показателей.
"""
import re
from datetime import datetime
from typing import Optional

from fastapi import HTTPException

from .lesson_lock import BAKU_TZ


def resolve_month(month: Optional[str]) -> str:
    """Месяц отчёта 'ГГГГ-ММ'; не задан — текущий (по Баку)."""
    if month is None:
        return datetime.now(BAKU_TZ).strftime("%Y-%m")
    if not re.fullmatch(r"\d{4}-(0[1-9]|1[0-2])", month):
        raise HTTPException(status_code=422, detail="Месяц должен быть в виде ГГГГ-ММ")
    return month


def month_bounds(month: str) -> tuple[datetime, datetime]:
    """'2026-09' → начало месяца и начало следующего, по Баку."""
    year, mon = (int(part) for part in month.split("-"))
    start = datetime(year, mon, 1, tzinfo=BAKU_TZ)
    end = datetime(year + (mon == 12), mon % 12 + 1, 1, tzinfo=BAKU_TZ)
    return start, end


def pct(part: int, total: int) -> Optional[float]:
    return round(part / total * 100, 1) if total else None


def avg(values: list) -> Optional[float]:
    return round(sum(values) / len(values), 1) if values else None


# Норма показателя — пара (норма, граница «жёлтого»); что хуже жёлтой границы — «красный».
def status_min(value: Optional[float], norm: tuple) -> str:
    """Чем больше, тем лучше."""
    if value is None:
        return "none"
    return "good" if value >= norm[0] else "warn" if value >= norm[1] else "bad"


def status_max(value: Optional[float], norm: tuple) -> str:
    """Чем меньше, тем лучше."""
    if value is None:
        return "none"
    return "good" if value <= norm[0] else "warn" if value <= norm[1] else "bad"


def summarize_indicators(indicators: list[dict], has_lessons: bool) -> dict:
    """Общий вывод по показателям: level (excellent | good | problems | none),
    сколько показателей оценено и сколько из них в норме."""
    rated = [i for i in indicators if i["status"] != "none"]
    bad = sum(1 for i in rated if i["status"] == "bad")
    good = sum(1 for i in rated if i["status"] == "good")
    if not rated or not has_lessons:
        level = "none"  # в этом месяце уроков ещё не было — оценивать нечего
    elif bad == 0 and good == len(rated):
        level = "excellent"
    elif bad <= 1 and good * 2 >= len(rated):
        level = "good"
    else:
        level = "problems"
    return {"level": level, "rated": len(rated), "good": good}
