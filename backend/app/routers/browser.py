from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.config import Settings, get_settings
from app.core.security import require_shared_secret
from app.models.schemas import (
    FetchSummaryRequest,
    FetchSummaryResponse,
    SearchResponse,
)
from app.services import page_reader
from app.services.ai_provider import AIEngine, ChatTurn, ProviderError
from app.services.search_provider import SearchNotConfiguredError, SearchProviderError, web_search

router = APIRouter(prefix="/api/browser", tags=["browser"], dependencies=[Depends(require_shared_secret)])


@router.get("/search", response_model=SearchResponse)
async def search(
    request: Request,
    q: str = Query(min_length=1, max_length=500),
    settings: Settings = Depends(get_settings),
) -> SearchResponse:
    client = request.app.state.http_client
    try:
        results, answer = await web_search(client, settings, q)
    except SearchNotConfiguredError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except SearchProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return SearchResponse(query=q, results=results, answer=answer, provider="tavily")


@router.post("/fetch", response_model=FetchSummaryResponse)
async def fetch_and_summarize(payload: FetchSummaryRequest, request: Request) -> FetchSummaryResponse:
    client = request.app.state.http_client
    engine: AIEngine = request.app.state.ai_engine

    try:
        title, text = await page_reader.fetch_readable_text(client, payload.url)
    except page_reader.PageFetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    if not text.strip():
        raise HTTPException(status_code=422, detail="No readable text found on that page.")

    messages = [
        ChatTurn(
            role="system",
            content=(
                "Summarize the following page content in 3-5 sentences, plainly and "
                "factually. Do not add opinions or filler."
            ),
        ),
        ChatTurn(role="user", content=f"Title: {title}\n\nContent:\n{text}"),
    ]

    summary_parts: list[str] = []
    try:
        async for _provider, delta in engine.stream_chat(messages):
            summary_parts.append(delta)
    except ProviderError as exc:
        raise HTTPException(status_code=502, detail=f"Couldn't summarize: {exc.message}") from exc

    return FetchSummaryResponse(url=payload.url, title=title, summary="".join(summary_parts).strip())
