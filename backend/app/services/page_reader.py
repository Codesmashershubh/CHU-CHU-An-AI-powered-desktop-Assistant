"""
Fetches a URL and extracts readable text from it.

Deliberately NOT a headless-browser fetch (Playwright/Puppeteer). A real
browser engine is 300MB+ of binaries and needs far more than 512MB of RAM to
run comfortably — it belongs on the user's own machine (see
frontend/electron for the local browser-automation plugin hook), not on a
free cloud instance. For "fetch this page and tell me what it says", a plain
HTTP GET plus HTML-to-text extraction is enough, and costs near-zero memory.
"""
from __future__ import annotations

import httpx
from bs4 import BeautifulSoup

MAX_CHARS = 6000

_UA = "Mozilla/5.0 (compatible; ChuChuAssistant/1.0; +https://github.com/)"


class PageFetchError(Exception):
    pass


async def fetch_readable_text(client: httpx.AsyncClient, url: str) -> tuple[str, str]:
    """Returns (title, text)."""
    if not (url.startswith("http://") or url.startswith("https://")):
        raise PageFetchError("URL must start with http:// or https://")

    try:
        response = await client.get(
            url, timeout=15.0, headers={"User-Agent": _UA}, follow_redirects=True
        )
    except httpx.HTTPError as exc:
        raise PageFetchError(f"couldn't reach that page: {exc}") from exc

    if response.status_code != 200:
        raise PageFetchError(f"page returned HTTP {response.status_code}")

    content_type = response.headers.get("content-type", "")
    if "text/html" not in content_type:
        raise PageFetchError(f"unsupported content type: {content_type or 'unknown'}")

    soup = BeautifulSoup(response.text, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header", "noscript", "svg"]):
        tag.decompose()

    title = soup.title.string.strip() if soup.title and soup.title.string else url
    text = " ".join(soup.get_text(separator=" ").split())

    return title, text[:MAX_CHARS]
