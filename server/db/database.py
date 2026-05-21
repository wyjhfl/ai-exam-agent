from sqlalchemy import text, inspect as sa_inspect
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase
from config import settings

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    connect_args={"check_same_thread": False},
    pool_pre_ping=True,
)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


USER_MIGRATIONS = {
    "llm_api_key": "VARCHAR(255)",
    "llm_base_url": "VARCHAR(500)",
    "llm_model": "VARCHAR(100)",
}

CHAT_HISTORY_MIGRATIONS = {
    "conversation_id": "INTEGER REFERENCES conversations(id)",
}


def _run_migrations(sync_conn):
    inspector = sa_inspect(sync_conn)
    if not inspector.has_table("users"):
        return
    existing = {col["name"] for col in inspector.get_columns("users")}
    for col_name, col_type in USER_MIGRATIONS.items():
        if col_name not in existing:
            sync_conn.execute(text(f"ALTER TABLE users ADD COLUMN {col_name} {col_type}"))

    if inspector.has_table("chat_histories"):
        existing = {col["name"] for col in inspector.get_columns("chat_histories")}
        for col_name, col_type in CHAT_HISTORY_MIGRATIONS.items():
            if col_name not in existing:
                sync_conn.execute(text(f"ALTER TABLE chat_histories ADD COLUMN {col_name} {col_type}"))


async def init_db():
    from db.models import Base
    async with engine.begin() as conn:
        await conn.execute(text("PRAGMA journal_mode=WAL"))
        await conn.execute(text("PRAGMA busy_timeout=5000"))
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_run_migrations)


async def get_session() -> AsyncSession:
    async with async_session() as session:
        yield session
