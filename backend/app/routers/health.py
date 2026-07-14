from __future__ import annotations

from fastapi import APIRouter, Request

from app.core.config import get_settings
from app.models.schemas import HealthOut

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthOut)
async def health(request: Request) -> HealthOut:
    settings = get_settings()
    engine = getattr(request.app.state, "ai_engine", None)
    providers = engine.configured_provider_names if engine else []
    return HealthOut(
        status="ok",
        app=settings.app_name,
        environment=settings.environment,
        providers_configured=providers,
    )
