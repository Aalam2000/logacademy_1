"""Проверка прод-БД перед выкаткой 0011+0012 (ничего не меняет).
Запуск на сервере (работает и на СТАРОМ образе бэкенда):
  docker compose -f docker-compose.prod.yml exec -T backend python - < scripts/prod_precheck.py
"""
import asyncio
from sqlalchemy import text
from app.database import engine

NEW_TABLES = ["homework_tasks", "homework_answers", "homework_answer_files", "lesson_messages"]
NEW_COLUMNS = [("group_members", "expel_reason"), ("group_members", "expelled_at"), ("group_members", "expelled_by"),
               ("materials", "is_personal"), ("materials", "content_hash")]


async def main():
    async with engine.connect() as c:
        ver = (await c.execute(text("select version_num from alembic_version"))).scalar()
        print(f"alembic: {ver}   (ожидаем 0010_course_templates_fields)")
        tables = [r[0] for r in await c.execute(text(
            "select table_name from information_schema.tables where table_schema='public' order by 1"))]
        print("таблицы:", ", ".join(tables))
        bad = [t for t in NEW_TABLES if t in tables]
        cols = {(r[0], r[1]) for r in await c.execute(text(
            "select table_name, column_name from information_schema.columns where table_schema='public'"))}
        bad += [f"{t}.{col}" for t, col in NEW_COLUMNS if (t, col) in cols]
        print("lesson_marks.comment есть:", ("lesson_marks", "comment") in cols)
        print("УЖЕ ЕСТЬ (мешает миграции):", ", ".join(bad) if bad else "нет — ОК")

asyncio.run(main())
