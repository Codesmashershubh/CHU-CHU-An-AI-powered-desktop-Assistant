from __future__ import annotations

import json
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Setting

DEFAULTS: dict[str, Any] = {
    "assistant_name": "Chu Chu",
    "theme": "dark",
    "voice_enabled": True,
    "voice_output_enabled": True,
    "wake_word_enabled": False,
    "always_on_top": False,
    "launch_at_login": False,
}


async def get_all(session: AsyncSession) -> dict[str, Any]:
    result = await session.execute(select(Setting))
    rows = {row.key: row.value for row in result.scalars().all()}
    merged: dict[str, Any] = dict(DEFAULTS)
    for key, raw in rows.items():
        try:
            merged[key] = json.loads(raw)
        except (json.JSONDecodeError, TypeError):
            merged[key] = raw
    return merged


async def update_many(session: AsyncSession, values: dict[str, Any]) -> dict[str, Any]:
    for key, value in values.items():
        existing = await session.get(Setting, key)
        serialized = json.dumps(value)
        if existing:
            existing.value = serialized
        else:
            session.add(Setting(key=key, value=serialized))
    await session.flush()
    return await get_all(session)
