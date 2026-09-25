"""Разовый отчёт о дублях в «Базе знаний» (ничего не удаляет).

1. Досчитывает materials.content_hash для старых файлов (загруженных до
   контроля дублей) — читает их из MinIO.
2. Печатает группы одинаковых файлов (по содержимому) и одинаковых
   ссылок (по нормализованному адресу) — с числом привязок к урокам.

Запуск:  python -m app.dedupe_report
"""
import asyncio
from collections import defaultdict

from sqlalchemy import select

from . import storage
from .database import AsyncSessionLocal
from .models import Link, Material
from .resources import content_hash, count_attachments_map, normalize_url


async def main() -> None:
    async with AsyncSessionLocal() as db:
        missing = (await db.execute(
            select(Material).where(Material.content_hash.is_(None), Material.is_personal == False)
        )).scalars().all()
        for m in missing:
            try:
                m.content_hash = content_hash(b"".join(storage.stream_object(m.object_key)))
            except Exception as e:
                print(f"!! не прочитан из MinIO: id={m.id} «{m.original_filename}»: {e}")
        await db.commit()
        print(f"Досчитано хэшей: {len(missing)}")

        counts = await count_attachments_map(db)

        by_hash = defaultdict(list)
        for m in (await db.execute(
            select(Material).where(Material.is_personal == False, Material.content_hash.isnot(None)).order_by(Material.id)
        )).scalars().all():
            by_hash[m.content_hash].append(m)
        groups = [g for g in by_hash.values() if len(g) > 1]
        print(f"\n=== Одинаковые файлы: {len(groups)} групп ===")
        for g in groups:
            print("---")
            for m in g:
                print(f"  id={m.id:<6} уроков={counts.get(('material', m.id), 0):<3} {m.created_at:%d.%m.%Y}  «{m.original_filename}»")

        by_url = defaultdict(list)
        for l in (await db.execute(select(Link).order_by(Link.id))).scalars().all():
            by_url[normalize_url(l.url)].append(l)
        groups = [g for g in by_url.values() if len(g) > 1]
        print(f"\n=== Одинаковые ссылки: {len(groups)} групп ===")
        for g in groups:
            print("---")
            for l in g:
                print(f"  id={l.id:<6} уроков={counts.get(('link', l.id), 0):<3} «{l.title}»  {l.url}")


if __name__ == "__main__":
    asyncio.run(main())
