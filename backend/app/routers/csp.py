"""Приём CSP-отчётов от браузеров и просмотр для админа.

POST /csp-report — без авторизации (отчёты шлёт браузер сам). Ограничения:
размер тела (и в nginx), не больше MAX_ROWS разных видов нарушений,
частота запросов — limit_req в nginx. В лог ничего не пишется: всё
складывается в csp_reports с дедупликацией (count/last_seen).

GET /csp-reports — админ, список по убыванию count.
"""
import json

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import func, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from ..csp import extract, normalize
from ..database import get_db
from ..dependencies import require_admin
from ..models import CspReport

router = APIRouter(tags=["csp"])

MAX_BODY = 64 * 1024
MAX_ROWS = 1000   # больше разных видов — уже мусор/атака, новые не принимаем


@router.post("/csp-report", status_code=204)
async def receive_csp_report(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    if len(body) > MAX_BODY:
        return Response(status_code=413)
    try:
        payload = json.loads(body or b"null")
    except ValueError:
        return Response(status_code=204)

    rows = [n for n in (normalize(r) for r in extract(payload)) if n]
    if not rows:
        return Response(status_code=204)

    ua = (request.headers.get("user-agent") or "")[:300] or None
    total = (await db.execute(select(func.count()).select_from(CspReport))).scalar_one()
    for row in rows:
        stmt = insert(CspReport).values(**row, user_agent=ua, count=1)
        stmt = stmt.on_conflict_do_update(
            index_elements=[CspReport.fingerprint],
            set_={
                "count": CspReport.count + 1,
                "last_seen": func.now(),
                "user_agent": stmt.excluded.user_agent,
                "sample": func.coalesce(stmt.excluded.sample, CspReport.sample),
            },
        )
        if total >= MAX_ROWS:
            # Таблица полна: обновляем только уже известные виды.
            exists = (await db.execute(
                select(CspReport.id).where(CspReport.fingerprint == row["fingerprint"])
            )).first()
            if not exists:
                continue
        await db.execute(stmt)
    await db.commit()
    return Response(status_code=204)


@router.get("/csp-reports")
async def list_csp_reports(db: AsyncSession = Depends(get_db), _admin=Depends(require_admin)):
    rows = (await db.execute(
        select(CspReport).order_by(CspReport.count.desc(), CspReport.last_seen.desc())
    )).scalars().all()
    return [
        {
            "directive": r.directive, "blocked": r.blocked, "page": r.page, "source": r.source,
            "disposition": r.disposition, "sample": r.sample, "user_agent": r.user_agent,
            "count": r.count, "first_seen": r.first_seen, "last_seen": r.last_seen,
        }
        for r in rows
    ]
