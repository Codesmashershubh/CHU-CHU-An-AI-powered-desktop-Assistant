"""
Central configuration for Chu Chu's backend.

Every value here is overridable via environment variable, which is how Render
(and local .env files) configure the running service. Nothing is hardcoded that
would force a redeploy to change — API keys, model choices, and feature toggles
are all runtime configuration.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Literal

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    # --- Core -----------------------------------------------------------
    app_name: str = "Chu Chu"
    environment: Literal["development", "production"] = "development"
    log_level: str = "info"

    # --- Networking / CORS ------------------------------------------------
    # Deliberately permissive by default. CORS is a browser-enforced rule about
    # which *origins* may read a response — it does nothing to stop a non-browser
    # client (curl, a script) from calling this API directly, and Electron pages
    # loaded from file:// send `Origin: null`, not `file://`, which makes origin
    # allowlisting fragile for exactly the client this backend exists to serve.
    # The real access boundary here is APP_SHARED_SECRET (see core/security.py).
    # Tighten this to your exact origin(s) if you also ship a web build.
    cors_origins: str = "*"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    # --- Access control ----------------------------------------------------
    # Render free web services are public URLs. Chu Chu is a single-user personal
    # assistant, not a multi-tenant SaaS, so we don't need real auth — but we DO
    # need to stop a stranger who finds your URL from burning your free AI quota.
    # If set, the Electron client must send this in the `X-Chu-Key` header.
    # Left empty, the gate is disabled (handy for local development).
    app_shared_secret: str = ""

    # --- Rate limiting (in-memory, single-instance — see core/ratelimit.py) --
    rate_limit_requests: int = 30
    rate_limit_window_seconds: int = 60

    # --- AI providers --------------------------------------------------------
    # Chu Chu never runs a model in-process. It calls free hosted inference
    # APIs over HTTP and fails over between them. See services/ai_provider.py.
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_whisper_model: str = "whisper-large-v3-turbo"

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.5-flash"

    openrouter_api_key: str = ""
    openrouter_model: str = "meta-llama/llama-3.3-70b-instruct:free"

    # Order providers are attempted in, comma-separated: groq,gemini,openrouter
    ai_provider_order: str = "groq,gemini,openrouter"

    @property
    def provider_order_list(self) -> list[str]:
        return [p.strip() for p in self.ai_provider_order.split(",") if p.strip()]

    ai_temperature: float = 0.6
    ai_max_tokens: int = 1024
    ai_request_timeout_seconds: float = 45.0

    # --- Web search (optional) ----------------------------------------------
    tavily_api_key: str = ""

    # --- Database --------------------------------------------------------------
    # Defaults to a local SQLite file so the app runs with zero setup. On Render's
    # free tier this file is wiped on every redeploy/restart — fine for trying
    # things out, not fine for real persistence. Point DATABASE_URL at a free
    # Neon/Supabase Postgres instance for data that survives redeploys.
    # See docs/DEPLOYMENT.md.
    database_url: str = "sqlite+aiosqlite:///./data/chuchu.db"

    @field_validator("database_url")
    @classmethod
    def _normalize_db_url(cls, v: str) -> str:
        # Render/Neon/Supabase commonly hand out "postgres://" or "postgresql://"
        # URLs; SQLAlchemy's async engine needs the asyncpg dialect spelled out.
        if v.startswith("postgres://"):
            v = "postgresql+asyncpg://" + v[len("postgres://"):]
        elif v.startswith("postgresql://") and "+asyncpg" not in v:
            v = "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v

    # --- Persona ---------------------------------------------------------------
    assistant_name: str = "Chu Chu"


@lru_cache
def get_settings() -> Settings:
    return Settings()
