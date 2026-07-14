"""
Chu Chu's AI engine.

Deliberately does NOT run a model in-process (that's what Ollama would have
meant — see docs/ARCHITECTURE.md for why that doesn't fit a 512MB Render free
instance). Instead this module calls free hosted inference over plain HTTP and
fails over between providers, so a single provider's rate limit or outage
doesn't take Chu Chu down.

Providers are tried in the order configured by AI_PROVIDER_ORDER. Failover only
happens *before* a provider has produced any output — once tokens have started
streaming to the user under one provider's name, we commit to it rather than
risk a duplicated or garbled reply.
"""
from __future__ import annotations

import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass
from typing import Protocol

import httpx

from app.core.config import Settings

logger = logging.getLogger("chuchu.ai_provider")


@dataclass
class ChatTurn:
    role: str  # "system" | "user" | "assistant"
    content: str


class ProviderError(Exception):
    def __init__(self, provider: str, message: str):
        self.provider = provider
        self.message = message
        super().__init__(f"[{provider}] {message}")


class Provider(Protocol):
    name: str

    def stream(
        self, messages: list[ChatTurn], *, temperature: float, max_tokens: int
    ) -> AsyncIterator[str]: ...


# --- OpenAI-compatible providers (Groq, OpenRouter) --------------------------------
# Both speak the same /chat/completions schema, so one implementation covers both.

class _OpenAICompatibleProvider:
    def __init__(
        self,
        *,
        name: str,
        client: httpx.AsyncClient,
        base_url: str,
        api_key: str,
        model: str,
        timeout: float,
        extra_headers: dict[str, str] | None = None,
    ):
        self.name = name
        self._client = client
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self._timeout = timeout
        self._extra_headers = extra_headers or {}

    async def stream(
        self, messages: list[ChatTurn], *, temperature: float, max_tokens: int
    ) -> AsyncIterator[str]:
        payload = {
            "model": self._model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "temperature": temperature,
            "max_tokens": max_tokens,
            "stream": True,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
            **self._extra_headers,
        }

        try:
            async with self._client.stream(
                "POST",
                f"{self._base_url}/chat/completions",
                json=payload,
                headers=headers,
                timeout=self._timeout,
            ) as response:
                if response.status_code != 200:
                    body = await response.aread()
                    raise ProviderError(
                        self.name,
                        f"HTTP {response.status_code}: {body[:400].decode(errors='replace')}",
                    )

                async for line in response.aiter_lines():
                    if not line or not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        break
                    try:
                        obj = json.loads(data)
                    except json.JSONDecodeError:
                        continue
                    choices = obj.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield content
        except httpx.TimeoutException as exc:
            raise ProviderError(self.name, f"timed out: {exc}") from exc
        except httpx.HTTPError as exc:
            raise ProviderError(self.name, f"network error: {exc}") from exc


def _build_groq(client: httpx.AsyncClient, settings: Settings) -> Provider:
    return _OpenAICompatibleProvider(
        name="groq",
        client=client,
        base_url="https://api.groq.com/openai/v1",
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        timeout=settings.ai_request_timeout_seconds,
    )


def _build_openrouter(client: httpx.AsyncClient, settings: Settings) -> Provider:
    return _OpenAICompatibleProvider(
        name="openrouter",
        client=client,
        base_url="https://openrouter.ai/api/v1",
        api_key=settings.openrouter_api_key,
        model=settings.openrouter_model,
        timeout=settings.ai_request_timeout_seconds,
        extra_headers={
            "HTTP-Referer": "https://github.com/",
            "X-Title": "Chu Chu",
        },
    )


# --- Gemini (different REST shape) ---------------------------------------------------

class _GeminiProvider:
    """Implemented as request-then-yield-once rather than true token streaming.

    Gemini's REST streaming shape (SSE with `alt=sse`) is more finicky to parse
    correctly, and this provider only runs when Groq/OpenRouter have already
    failed — reliability matters far more than incremental smoothness on a
    fallback path, so we trade a little UX polish for a much simpler, easier to
    verify implementation.
    """

    def __init__(self, *, client: httpx.AsyncClient, api_key: str, model: str, timeout: float):
        self.name = "gemini"
        self._client = client
        self._api_key = api_key
        self._model = model
        self._timeout = timeout

    async def stream(
        self, messages: list[ChatTurn], *, temperature: float, max_tokens: int
    ) -> AsyncIterator[str]:
        system_parts = [m.content for m in messages if m.role == "system"]
        contents = [
            {"role": "model" if m.role == "assistant" else "user", "parts": [{"text": m.content}]}
            for m in messages
            if m.role != "system"
        ]

        payload: dict = {
            "contents": contents,
            "generationConfig": {
                "temperature": temperature,
                "maxOutputTokens": max_tokens,
            },
        }
        if system_parts:
            payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}

        url = (
            f"https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self._model}:generateContent?key={self._api_key}"
        )

        try:
            response = await self._client.post(url, json=payload, timeout=self._timeout)
        except httpx.TimeoutException as exc:
            raise ProviderError(self.name, f"timed out: {exc}") from exc
        except httpx.HTTPError as exc:
            raise ProviderError(self.name, f"network error: {exc}") from exc

        if response.status_code != 200:
            raise ProviderError(self.name, f"HTTP {response.status_code}: {response.text[:400]}")

        try:
            data = response.json()
            candidates = data.get("candidates") or []
            if not candidates:
                block_reason = (data.get("promptFeedback") or {}).get("blockReason")
                raise ProviderError(self.name, f"no candidates returned (blockReason={block_reason})")
            parts = candidates[0].get("content", {}).get("parts", [])
            text = "".join(p.get("text", "") for p in parts)
        except (KeyError, IndexError, TypeError) as exc:
            raise ProviderError(self.name, f"unexpected response shape: {exc}") from exc

        if text:
            yield text


def _build_gemini(client: httpx.AsyncClient, settings: Settings) -> Provider:
    return _GeminiProvider(
        client=client,
        api_key=settings.gemini_api_key,
        model=settings.gemini_model,
        timeout=settings.ai_request_timeout_seconds,
    )


# --- Orchestrator --------------------------------------------------------------------

_BUILDERS = {
    "groq": (_build_groq, "groq_api_key"),
    "gemini": (_build_gemini, "gemini_api_key"),
    "openrouter": (_build_openrouter, "openrouter_api_key"),
}


class AIEngine:
    def __init__(self, http_client: httpx.AsyncClient, settings: Settings):
        self._settings = settings
        self._providers: list[Provider] = []
        for provider_name in settings.provider_order_list:
            entry = _BUILDERS.get(provider_name)
            if entry is None:
                continue
            builder, key_attr = entry
            if getattr(settings, key_attr, ""):
                self._providers.append(builder(http_client, settings))

    @property
    def configured_provider_names(self) -> list[str]:
        return [p.name for p in self._providers]

    async def stream_chat(
        self, messages: list[ChatTurn]
    ) -> AsyncIterator[tuple[str, str]]:
        """Yields (provider_name, text_delta). Raises ProviderError if every
        configured provider fails before producing any output."""
        if not self._providers:
            raise ProviderError(
                "none",
                "No AI provider is configured. Set GROQ_API_KEY on the backend "
                "(console.groq.com — free, no card) to get started.",
            )

        last_error: Exception | None = None
        for provider in self._providers:
            started = False
            try:
                async for delta in provider.stream(
                    messages,
                    temperature=self._settings.ai_temperature,
                    max_tokens=self._settings.ai_max_tokens,
                ):
                    started = True
                    yield provider.name, delta
                return
            except Exception as exc:  # noqa: BLE001 — provider failures are expected/handled
                last_error = exc
                logger.warning("provider %s failed: %s", provider.name, exc)
                if started:
                    raise
                continue

        raise ProviderError("all", f"All configured providers failed. Last error: {last_error}")
