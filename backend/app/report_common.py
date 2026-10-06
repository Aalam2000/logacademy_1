"""Общее для отчётов по педагогу и по ученику (teacher_report.py, student_report.py):
период отчёта, оценка показателя по норме и общий вывод по набору показателей.
"""
import re
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
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


# Период отчёта (решение Андрея, 2026-10-06):
#   month  — календарный месяц (с листанием); текущий месяц = «с начала месяца»;
#   year   — с начала учебного года (1 сентября) по сегодня;
#   all    — с начала обучения (ученик) / преподавания (педагог) по сегодня:
#            start не задан, его ставит сам отчёт по первому уроку;
#   custom — произвольный: с date_from по date_to включительно.
# Сравнение с прошлым месяцем есть только у month.
PERIOD_KINDS = ("month", "year", "all", "custom")
SCHOOL_YEAR_START_MONTH = 9


@dataclass(frozen=True)
class Period:
    kind: str
    start: Optional[datetime]   # None — с первого урока (kind == "all")
    end: datetime               # не включительно
    month: Optional[str] = None  # 'ГГГГ-ММ' у kind == "month"

    def previous_month(self) -> Optional[tuple[datetime, datetime]]:
        """Прошлый месяц для сравнения — только у месячного отчёта."""
        if self.kind != "month":
            return None
        return month_bounds((self.start - timedelta(days=1)).strftime("%Y-%m"))[0], self.start

    def out(self, start: Optional[datetime] = None) -> dict:
        """Для ответа API: границы — даты по Баку, обе включительно."""
        start = self.start or start
        last = min(self.end, datetime.now(BAKU_TZ) + timedelta(days=1)) - timedelta(seconds=1)
        return {
            "kind": self.kind,
            "month": self.month,
            "from": start.astimezone(BAKU_TZ).date().isoformat() if start else None,
            "to": last.astimezone(BAKU_TZ).date().isoformat(),
        }


def _parse_day(value: Optional[str], name: str) -> date:
    try:
        return date.fromisoformat(value or "")
    except ValueError:
        raise HTTPException(status_code=422, detail=f"{name}: дата должна быть в виде ГГГГ-ММ-ДД")


def resolve_period(
    period: Optional[str] = None,
    month: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
) -> Period:
    kind = period or "month"
    if kind not in PERIOD_KINDS:
        raise HTTPException(status_code=422, detail="Неизвестный период отчёта")
    today = datetime.now(BAKU_TZ).date()
    tomorrow = datetime.combine(today + timedelta(days=1), time.min, tzinfo=BAKU_TZ)
    if kind == "month":
        month = resolve_month(month)
        start, end = month_bounds(month)
        return Period("month", start, end, month)
    if kind == "year":
        year = today.year if today.month >= SCHOOL_YEAR_START_MONTH else today.year - 1
        return Period("year", datetime(year, SCHOOL_YEAR_START_MONTH, 1, tzinfo=BAKU_TZ), tomorrow)
    if kind == "all":
        return Period("all", None, tomorrow)
    first, last = _parse_day(date_from, "date_from"), _parse_day(date_to, "date_to")
    if last < first:
        raise HTTPException(status_code=422, detail="Конец периода раньше начала")
    return Period(
        "custom",
        datetime.combine(first, time.min, tzinfo=BAKU_TZ),
        datetime.combine(last + timedelta(days=1), time.min, tzinfo=BAKU_TZ),
    )


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
        level = "none"  # за период уроков не было — оценивать нечего
    elif bad == 0 and good == len(rated):
        level = "excellent"
    elif bad <= 1 and good * 2 >= len(rated):
        level = "good"
    else:
        level = "problems"
    return {"level": level, "rated": len(rated), "good": good}
