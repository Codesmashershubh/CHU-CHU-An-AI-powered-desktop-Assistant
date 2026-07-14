"""
POST /api/chat streams a reply over Server-Sent Events with three event types:

  event: token   data: {"content": "..."}         — a chunk of visible reply text
  event: action  data: {"action": "...", ...}      — a validated automation request
  event: done    data: {"provider": "...", ...}    — stream finished successfully
  event: error   data: {"message": "..."}          — every configured provider failed

Text and actions are interleaved in real time as the model streams, so the UI
can render the reply progressively and still catch an action block wherever
it appears in the response.
"""
from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.core.config import get_settings
from app.core.db import session_scope
from app.core.ratelimit import enforce_rate_limit
from app.core.security import require_shared_secret
from app.models.schemas import ChatRequest
from app.repositories import history_repo, settings_repo
from app.services.ai_provider import AIEngine, ChatTurn, ProviderError
from app.services.automation_intents import validate_action
from app.services.prompts import build_system_prompt
from app.services.streaming import ActionRawEvent, StreamActionExtractor, TokenEvent, try_parse_action_json

router = APIRouter(
    prefix="/api/chat",
    tags=["chat"],
    dependencies=[Depends(require_shared_secret), Depends(enforce_rate_limit)],
)

HISTORY_TURNS_FOR_CONTEXT = 20


def _sse(event: str, data: dict) -> str:
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


@router.post("")
async def chat(payload: ChatRequest, request: Request) -> StreamingResponse:
    settings = get_settings()
    engine: AIEngine = request.app.state.ai_engine

    async with session_scope() as session:
        await history_repo.add_message(
            session, conversation_id=payload.conversation_id, role="user", content=payload.message
        )
        recent = await history_repo.recent_messages(
            session, conversation_id=payload.conversation_id, limit=HISTORY_TURNS_FOR_CONTEXT
        )
        user_settings = await settings_repo.get_all(session)

    assistant_name = user_settings.get("assistant_name") or settings.assistant_name
    system_prompt = build_system_prompt(assistant_name=assistant_name)

    messages = [ChatTurn(role="system", content=system_prompt)]
    messages += [ChatTurn(role=m.role, content=m.content) for m in recent if m.role in ("user", "assistant")]

    async def event_stream():
        extractor = StreamActionExtractor()
        visible_parts: list[str] = []
        provider_used: str | None = None

        try:
            async for provider_name, delta in engine.stream_chat(messages):
                provider_used = provider_name
                for event in extractor.feed(delta):
                    if isinstance(event, TokenEvent):
                        if event.text:
                            visible_parts.append(event.text)
                            yield _sse("token", {"content": event.text})
                    elif isinstance(event, ActionRawEvent):
                        raw = try_parse_action_json(event.raw)
                        validated = validate_action(raw) if raw is not None else None
                        if validated is not None:
                            yield _sse("action", validated.model_dump())

            for event in extractor.finalize():
                if isinstance(event, TokenEvent) and event.text:
                    visible_parts.append(event.text)
                    yield _sse("token", {"content": event.text})

        except ProviderError as exc:
            yield _sse("error", {"message": exc.message, "provider": exc.provider})
            return
        except Exception as exc:  # noqa: BLE001 — last-resort net so a bug never
            # leaves the client mid-stream with no explanation. Logged for us,
            # summarized (not detailed) for the client.
            logging.getLogger("chuchu.chat").exception("unexpected error mid-stream: %s", exc)
            yield _sse("error", {"message": "Something went wrong on Chu Chu's end.", "provider": provider_used})
            return

        full_text = "".join(visible_parts).strip()
        if full_text:
            async with session_scope() as session:
                await history_repo.add_message(
                    session,
                    conversation_id=payload.conversation_id,
                    role="assistant",
                    content=full_text,
                    provider=provider_used,
                )

        yield _sse("done", {"provider": provider_used, "conversation_id": payload.conversation_id})

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # tell proxies (nginx et al.) not to buffer the stream
            "Connection": "keep-alive",
        },
    )
