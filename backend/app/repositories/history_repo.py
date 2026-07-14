from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import HistoryMessage


async def add_message(
    session: AsyncSession,
    *,
    conversation_id: str,
    role: str,
    content: str,
    provider: str | None = None,
) -> HistoryMessage:
    msg = HistoryMessage(
        conversation_id=conversation_id,
        role=role,
        content=content,
        provider=provider,
    )
    session.add(msg)
    await session.flush()
    return msg


async def recent_messages(
    session: AsyncSession, *, conversation_id: str = "default", limit: int = 50
) -> list[HistoryMessage]:
    stmt = (
        select(HistoryMessage)
        .where(HistoryMessage.conversation_id == conversation_id)
        .order_by(HistoryMessage.created_at.desc())
        .limit(limit)
    )
    result = await session.execute(stmt)
    messages = list(result.scalars().all())
    messages.reverse()  # chronological order for the client / for prompt context
    return messages


async def clear_conversation(session: AsyncSession, *, conversation_id: str = "default") -> None:
    await session.execute(delete(HistoryMessage).where(HistoryMessage.conversation_id == conversation_id))
