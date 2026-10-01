"""Сводка CSP-нарушений из csp_reports (по убыванию числа повторов).

Запуск на сервере:
  docker compose -f docker-compose.prod.yml exec backend python -m app.csp_report_list
  … python -m app.csp_report_list --clear   # очистить после разбора
"""
import asyncio
import sys

from sqlalchemy import delete, select

from .database import AsyncSessionLocal
from .models import CspReport


async def main() -> None:
    async with AsyncSessionLocal() as db:
        if "--clear" in sys.argv:
            n = (await db.execute(delete(CspReport))).rowcount
            await db.commit()
            print(f"удалено строк: {n}")
            return
        rows = (await db.execute(
            select(CspReport).order_by(CspReport.count.desc(), CspReport.last_seen.desc())
        )).scalars().all()
        if not rows:
            print("нарушений нет")
            return
        print(f"видов нарушений: {len(rows)}, всего отчётов: {sum(r.count for r in rows)}\n")
        for r in rows:
            print(f"{r.count:>6}  {r.directive:<18} {r.blocked}")
            print(f"        страница: {r.page}   код: {r.source or '-'}   [{r.disposition}]")
            print(f"        первый: {r.first_seen:%Y-%m-%d %H:%M}  последний: {r.last_seen:%Y-%m-%d %H:%M}")
            if r.sample:
                print(f"        фрагмент: {r.sample}")
            print()


if __name__ == "__main__":
    asyncio.run(main())
