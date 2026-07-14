import { useCallback, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

export type VoiceStatus = "idle" | "recording" | "transcribing" | "error";

interface UseVoiceResult {
  status: VoiceStatus;
  errorMessage: string | null;
  start: () => Promise<void>;
  stop: () => Promise<string | null>;
}

/**
 * Deliberately does not use the Web Speech API's SpeechRecognition — it
 * doesn't work inside Electron (see docs/ARCHITECTURE.md). This records
 * locally with MediaRecorder instead (which works fine in Electron, since
 * it's local media capture with no external service involved) and sends the
 * clip to the backend, which forwards it to Groq's hosted Whisper endpoint.
 */
export function useVoice(): UseVoiceResult {
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const start = useCallback(async () => {
    setErrorMessage(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setStatus("recording");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access was denied. Check your OS privacy settings for Chu Chu."
          : "Couldn't access the microphone.";
      setErrorMessage(message);
      setStatus("error");
    }
  }, []);

  const stop = useCallback(async (): Promise<string | null> => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return null;

    setStatus("transcribing");

    const blob: Blob = await new Promise((resolve) => {
      recorder.onstop = () => resolve(new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" }));
      recorder.stop();
    });

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    mediaRecorderRef.current = null;

    try {
      const { text } = await api.voice.transcribe(blob);
      setStatus("idle");
      return text;
    } catch (err) {
      const message =
        err instanceof ApiError && err.status === 501
          ? "Voice input isn't configured on the backend yet — add a GROQ_API_KEY."
          : "Couldn't transcribe that — try again?";
      setErrorMessage(message);
      setStatus("error");
      return null;
    }
  }, []);

  return { status, errorMessage, start, stop };
}
