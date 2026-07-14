from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile

from app.core.config import Settings, get_settings
from app.core.security import require_shared_secret
from app.models.schemas import TranscribeResponse
from app.services.voice_provider import VoiceNotConfiguredError, VoiceProviderError, transcribe

router = APIRouter(prefix="/api/voice", tags=["voice"], dependencies=[Depends(require_shared_secret)])

MAX_AUDIO_BYTES = 20 * 1024 * 1024  # 20MB — generous for a few minutes of voice input


@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_audio(
    request: Request,
    file: UploadFile,
    settings: Settings = Depends(get_settings),
) -> TranscribeResponse:
    audio_bytes = await file.read()
    if len(audio_bytes) > MAX_AUDIO_BYTES:
        raise HTTPException(status_code=413, detail="Audio clip too large (max 20MB).")
    if not audio_bytes:
        raise HTTPException(status_code=422, detail="Empty audio upload.")

    client = request.app.state.http_client
    try:
        text = await transcribe(
            client,
            settings,
            audio_bytes=audio_bytes,
            filename=file.filename or "audio.webm",
            content_type=file.content_type or "audio/webm",
        )
    except VoiceNotConfiguredError as exc:
        raise HTTPException(status_code=501, detail=str(exc)) from exc
    except VoiceProviderError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return TranscribeResponse(text=text, provider="groq-whisper")
