from __future__ import annotations

import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import get_settings
from app.core.db import init_db
from app.routers import automation, browser, chat, health, history, notes, reminders, settings_router, voice
from app.services.ai_provider import AIEngine

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("chuchu")


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    settings = get_settings()

    await init_db()

    # One shared HTTP client for the whole app lifetime — reused across every
    # AI-provider, search, and page-fetch call so we're not paying a fresh
    # TLS handshake per request on an already CPU-starved free instance.
    app.state.http_client = httpx.AsyncClient(
        timeout=httpx.Timeout(settings.ai_request_timeout_seconds),
        limits=httpx.Limits(max_connections=10, max_keepalive_connections=5),
    )
    app.state.ai_engine = AIEngine(app.state.http_client, settings)

    if not app.state.ai_engine.configured_provider_names:
        logger.warning(
            "No AI provider configured — set GROQ_API_KEY (free, no card, "
            "console.groq.com) so /api/chat has something to talk to."
        )
    else:
        logger.info("AI providers ready: %s", app.state.ai_engine.configured_provider_names)

    yield

    await app.state.http_client.aclose()


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=f"{settings.app_name} backend",
        description="Chu Chu's backend + AI engine — a free-tier-optimized OS assistant API.",
        version="1.0.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router)
    app.include_router(chat.router)
    app.include_router(notes.router)
    app.include_router(reminders.router)
    app.include_router(history.router)
    app.include_router(settings_router.router)
    app.include_router(voice.router)
    app.include_router(browser.router)
    app.include_router(automation.router)

    return app


app = create_app()
