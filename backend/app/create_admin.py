import asyncio
import os
import getpass
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine
from werkzeug.security import generate_password_hash

DEFAULT_DATABASE_URL = "postgresql+asyncpg://logacademy:secret@db:5432/logacademy"

async def create_admin(username: str, password: str) -> None:
    database_url = os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)
    engine = create_async_engine(database_url)
    try:
        async with engine.begin() as conn:
            existing = await conn.scalar(
                text("SELECT id FROM users WHERE username = :u"),
                {"u": username}
            )
            if existing:
                print(f"❌ Пользователь '{username}' уже существует (id={existing})")
                return
            hashed = generate_password_hash(password)
            await conn.execute(
                text("INSERT INTO users (username, hashed_password, role) VALUES (:u, :p, 'admin')"),
                {"u": username, "p": hashed}
            )
            print(f"✅ Админ '{username}' создан успешно")
    finally:
        await engine.dispose()

if __name__ == "__main__":
    username = input("Username: ").strip()
    password = getpass.getpass("Password: ")
    asyncio.run(create_admin(username, password))