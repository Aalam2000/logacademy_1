import asyncio
import os
import subprocess

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


DEFAULT_DATABASE_URL = "postgresql+asyncpg://logacademy:secret@db:5432/logacademy"


async def _needs_initial_stamp(database_url: str) -> bool:
    engine = create_async_engine(database_url)
    try:
        async with engine.connect() as conn:
            version_table = await conn.scalar(text("select to_regclass('public.alembic_version')"))
            if version_table:
                return False

            tables_count = await conn.scalar(
                text(
                    """
                    select count(*)
                    from information_schema.tables
                    where table_schema = 'public'
                    """
                )
            )
            return int(tables_count or 0) > 0
    finally:
        await engine.dispose()


def _run_alembic(*args: str) -> None:
    subprocess.run(["alembic", *args], check=True)


def main() -> None:
    database_url = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    if asyncio.run(_needs_initial_stamp(database_url)):
        _run_alembic("stamp", "head")

    _run_alembic("upgrade", "head")


if __name__ == "__main__":
    main()
