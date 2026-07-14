from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_shared_secret
from app.models.schemas import ChatHistoryItem
from app.repositories import history_repo

router = APIRouter(
    prefix="/api/history", tags=["history"], dependencies=[Depends(require_shared_secret)]
)


@router.get("", response_model=list[ChatHistoryItem])
async def get_history(
    conversation_id: str = "default", limit: int = 50, session: AsyncSession = Depends(get_session)
) -> list[ChatHistoryItem]:
    messages = await history_repo.recent_messages(
        session, conversation_id=conversation_id, limit=min(limit, 200)
    )
    return [ChatHistoryItem.model_validate(m) for m in messages]


@router.delete("", status_code=204, response_model=None)
async def clear_history(
    conversation_id: str = "default", session: AsyncSession = Depends(get_session)
) -> None:
    await history_repo.clear_conversation(session, conversation_id=conversation_id)
