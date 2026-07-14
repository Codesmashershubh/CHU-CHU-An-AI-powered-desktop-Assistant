"""
Async database engine + session management.

One DATABASE_URL drives everything: `sqlite+aiosqlite:///...` for local/zero-config
use, or `postgresql+asyncpg://...` (Neon, Supabase, Render Postgres, etc.) for a
deployment where data should survive a redeploy. Repositories write plain
SQLAlchemy Core/ORM and never care which backend is underneath.
"""
from __future__ import annotations

import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import get_settings


class Base(DeclarativeBase):
    pass


def _make_engine():
    settings = get_settings()
    url = settings.database_url

    if url.startswith("sqlite"):
        # Local SQLite lives under backend/data/ — make sure that directory
        # exists before aiosqlite tries to open a file in it.
        path_part = url.split("///")[-1]
        directory = os.path.dirname(path_part)
        if directory:
            os.makedirs(directory, exist_ok=True)
        connect_args = {"check_same_thread": False}
    else:
        connect_args = {}

    return create_async_engine(
        url,
        echo=False,
        pool_pre_ping=True,
        connect_args=connect_args,
    )


engine = _make_engine()
SessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def init_db() -> None:
    """Create tables if they don't exist yet. Safe to call on every boot."""
    # Import models so they're registered on Base.metadata before create_all.
    from app.models import orm  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Context-manager form, used outside of FastAPI's DI (startup, scripts)."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise


async def get_session() -> AsyncIterator[AsyncSession]:
    """FastAPI dependency form — `session: AsyncSession = Depends(get_session)`."""
    async with SessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
