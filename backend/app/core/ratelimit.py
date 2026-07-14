"""
A small fixed-window rate limiter, kept in process memory.

No Redis, no external dependency: Render's free web service is always exactly
one instance (horizontal scaling isn't offered on the free tier anyway), so
in-memory state is never split across processes. This exists purely to stop a
runaway client loop — or a stranger who found your URL — from blowing through
your free AI-provider quota in seconds, not to serve as real production
throttling.
"""
from __future__ import annotations

import time
from collections import defaultdict

from fastapi import HTTPException, Request, status

from app.core.config import get_settings

_hits: dict[str, list[float]] = defaultdict(list)


def _client_key(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "unknown"


async def enforce_rate_limit(request: Request) -> None:
    settings = get_settings()
    limit = settings.rate_limit_requests
    window = settings.rate_limit_window_seconds
    if limit <= 0:
        return

    key = _client_key(request)
    now = time.monotonic()
    window_start = now - window

    hits = _hits[key]
    while hits and hits[0] < window_start:
        hits.pop(0)

    if len(hits) >= limit:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded ({limit} requests / {window}s). Slow down a little.",
        )

    hits.append(now)
