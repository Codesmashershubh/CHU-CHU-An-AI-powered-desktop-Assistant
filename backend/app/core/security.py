"""
Chu Chu is a single-user personal assistant, not a multi-tenant SaaS — so this
is intentionally not a full auth system. But a Render free-tier web service
lives at a public, guessable-ish URL (yourapp.onrender.com), and anything that
hits it burns your free AI-provider quota and your 750 free instance-hours.

APP_SHARED_SECRET, when set, closes that off: the Electron client sends it as
a header, and requests without it are rejected. Leave it unset for local
development.
"""
from __future__ import annotations

import hmac

from fastapi import Header, HTTPException, status

from app.core.config import get_settings


async def require_shared_secret(x_chu_key: str = Header(default="")) -> None:
    settings = get_settings()
    if not settings.app_shared_secret:
        return  # gate disabled — local dev / user opted out
    if not hmac.compare_digest(x_chu_key, settings.app_shared_secret):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing or invalid X-Chu-Key header.",
        )
