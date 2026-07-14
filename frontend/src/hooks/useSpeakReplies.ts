import { useEffect, useRef } from "react";
import type { ChatMessageVM } from "@/types";

/**
 * Speaks each assistant reply aloud once it finishes streaming, using the
 * OS's own TTS voices via the browser's SpeechSynthesis API — this is the
 * half of the Web Speech API that *does* work in Electron (unlike
 * SpeechRecognition; see docs/ARCHITECTURE.md).
 *
 * Only speaks messages that were actively streaming during this session —
 * history loaded from the backend on mount arrives already `done` and is
 * deliberately never spoken, or opening the app would read your entire past
 * conversation aloud.
 */
export function useSpeakReplies(messages: ChatMessageVM[], enabled: boolean): void {
  const everStreamingRef = useRef<Set<string>>(new Set());
  const spokenRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!enabled || typeof window === "undefined" || !window.speechSynthesis) return;

    for (const message of messages) {
      if (message.role !== "assistant") continue;

      if (message.status === "streaming" || message.status === "pending") {
        everStreamingRef.current.add(message.id);
        continue;
      }

      const shouldSpeak =
        message.status === "done" &&
        everStreamingRef.current.has(message.id) &&
        !spokenRef.current.has(message.id) &&
        message.content.trim().length > 0;

      if (shouldSpeak) {
        spokenRef.current.add(message.id);
        window.speechSynthesis.cancel(); // don't let replies queue up and read back-to-back oddly
        window.speechSynthesis.speak(new SpeechSynthesisUtterance(message.content));
      }
    }
  }, [messages, enabled]);

  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    []
  );
}
