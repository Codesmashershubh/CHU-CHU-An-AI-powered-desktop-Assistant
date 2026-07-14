from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_shared_secret
from app.models.schemas import SettingsOut, SettingsUpdate
from app.repositories import settings_repo

router = APIRouter(
    prefix="/api/settings", tags=["settings"], dependencies=[Depends(require_shared_secret)]
)


@router.get("", response_model=SettingsOut)
async def get_settings_values(session: AsyncSession = Depends(get_session)) -> SettingsOut:
    return SettingsOut(values=await settings_repo.get_all(session))


@router.put("", response_model=SettingsOut)
async def update_settings_values(
    payload: SettingsUpdate, session: AsyncSession = Depends(get_session)
) -> SettingsOut:
    return SettingsOut(values=await settings_repo.update_many(session, payload.values))
