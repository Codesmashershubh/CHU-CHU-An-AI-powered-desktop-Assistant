"""
Web search, via Tavily — the one search API in this space with a genuinely
free, no-credit-card tier (1,000 queries/month) built specifically for feeding
LLM agents rather than rendering a results page. See docs/ARCHITECTURE.md for
why alternatives (Brave, SerpAPI, scraping DuckDuckGo's HTML) were passed over.

Entirely optional: if TAVILY_API_KEY isn't set, callers get a clear
"not configured" result instead of a crash, and Chu Chu keeps working for
everything else.
"""
from __future__ import annotations

import httpx

from app.core.config import Settings
from app.models.schemas import SearchResultItem


class SearchNotConfiguredError(Exception):
    pass


class SearchProviderError(Exception):
    pass


async def web_search(
    client: httpx.AsyncClient, settings: Settings, query: str, *, max_results: int = 5
) -> tuple[list[SearchResultItem], str | None]:
    if not settings.tavily_api_key:
        raise SearchNotConfiguredError(
            "Web search isn't configured. Add a free TAVILY_API_KEY "
            "(tavily.com — 1,000 free searches/month, no card) to enable it."
        )

    try:
        response = await client.post(
            "https://api.tavily.com/search",
            json={
                "api_key": settings.tavily_api_key,
                "query": query,
                "max_results": max_results,
                "include_answer": True,
            },
            timeout=20.0,
        )
    except httpx.HTTPError as exc:
        raise SearchProviderError(f"network error contacting Tavily: {exc}") from exc

    if response.status_code != 200:
        raise SearchProviderError(f"Tavily returned HTTP {response.status_code}: {response.text[:300]}")

    data = response.json()
    results = [
        SearchResultItem(
            title=item.get("title", ""),
            url=item.get("url", ""),
            snippet=item.get("content", "")[:500],
        )
        for item in data.get("results", [])
    ]
    return results, data.get("answer")
