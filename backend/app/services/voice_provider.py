"""
Speech-to-text, via Groq's hosted Whisper endpoint.

Two reasons this isn't a local model:
  1. Whisper (even "tiny") needs real CPU and a few hundred MB of RAM the
     Render free instance doesn't have to spare.
  2. Electron's renderer can't use the browser's built-in SpeechRecognition —
     Chromium's implementation calls a Google service that's only wired up
     for Chrome-branded builds, so it throws a "network error" inside
     Electron every time. (Filed and still open upstream:
     electron/electron#46143.) Recording locally with MediaRecorder and
     sending the audio to a hosted Whisper endpoint sidesteps that entirely
     and works identically on every OS.

Groq's free tier includes Whisper transcription, so the same GROQ_API_KEY
that powers chat covers voice too — no separate signup.
"""
from __future__ import annotations

import httpx

from app.core.config import Settings


class VoiceNotConfiguredError(Exception):
    pass


class VoiceProviderError(Exception):
    pass


async def transcribe(
    client: httpx.AsyncClient,
    settings: Settings,
    *,
    audio_bytes: bytes,
    filename: str,
    content_type: str,
) -> str:
    if not settings.groq_api_key:
        raise VoiceNotConfiguredError(
            "Voice input isn't configured. Add a free GROQ_API_KEY to enable transcription."
        )

    files = {"file": (filename, audio_bytes, content_type or "audio/webm")}
    data = {"model": settings.groq_whisper_model, "response_format": "json"}
    headers = {"Authorization": f"Bearer {settings.groq_api_key}"}

    try:
        response = await client.post(
            "https://api.groq.com/openai/v1/audio/transcriptions",
            files=files,
            data=data,
            headers=headers,
            timeout=60.0,
        )
    except httpx.HTTPError as exc:
        raise VoiceProviderError(f"network error contacting Groq: {exc}") from exc

    if response.status_code != 200:
        raise VoiceProviderError(f"Groq returned HTTP {response.status_code}: {response.text[:300]}")

    payload = response.json()
    text = payload.get("text", "").strip()
    if not text:
        raise VoiceProviderError("transcription came back empty")
    return text
