"""Проверка прод-БД перед выкаткой миграций (ничего не меняет).

Текущая выкатка (2026-09-28, ветка vite): 0014_lesson_duration + 0015_perf_indexes.
Перед следующей выкаткой с миграциями — поправить EXPECTED_* ниже.

Запуск на сервере (работает и на СТАРОМ образе бэкенда):
  git fetch origin && git show origin/master:scripts/prod_precheck.py | \
    docker compose -f docker-compose.prod.yml exec -T backend python -
"""
import asyncio
from sqlalchemy import text
from app.database import engine

EXPECTED_REVISION = "0013_group_video_url"   # последняя уже выкаченная
NEW_COLUMNS = [("lessons", "duration_min"), ("groups", "lesson_duration_min")]
NEW_INDEXES = ["ix_lessons_group_id_date", "ix_group_members_group_id",
               "ix_group_members_student_id", "ix_lesson_marks_student_id"]


async def main():
    async with engine.connect() as c:
        ver = (await c.execute(text("select version_num from alembic_version"))).scalar()
        print(f"alembic: {ver}   (ожидаем {EXPECTED_REVISION})")
        cols = {(r[0], r[1]) for r in await c.execute(text(
            "select table_name, column_name from information_schema.columns where table_schema='public'"))}
        idx = {r[0] for r in await c.execute(text(
            "select indexname from pg_indexes where schemaname='public'"))}
        bad = [f"{t}.{col}" for t, col in NEW_COLUMNS if (t, col) in cols] + [i for i in NEW_INDEXES if i in idx]
        print("уроков:", (await c.execute(text("select count(*) from lessons"))).scalar(),
              "| групп:", (await c.execute(text("select count(*) from groups"))).scalar())
        print("УЖЕ ЕСТЬ (мешает миграции):", ", ".join(bad) if bad else "нет — ОК")

asyncio.run(main())
