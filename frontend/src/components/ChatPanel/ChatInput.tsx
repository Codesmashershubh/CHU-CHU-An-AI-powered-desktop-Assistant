import { useRef, useState, type KeyboardEvent } from "react";
import { ArrowUp } from "lucide-react";
import { VoicePulse } from "@/components/VoicePulse/VoicePulse";
import { useVoice } from "@/hooks/useVoice";
import { useChuChuStore } from "@/lib/store";
import styles from "./ChatInput.module.css";

interface ChatInputProps {
  onSend: (text: string) => void;
  disabled?: boolean;
}

export function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const voice = useVoice();
  const voiceEnabled = useChuChuStore((s) => s.settings?.voice_enabled ?? true);

  function autoResize() {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }

  function handleSend() {
    const trimmed = value.trim();
    if (!trimmed || disabled) return;
    onSend(trimmed);
    setValue("");
    requestAnimationFrame(autoResize);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  }

  async function handleVoicePress() {
    if (voice.status === "idle" || voice.status === "error") {
      await voice.start();
    } else if (voice.status === "recording") {
      const text = await voice.stop();
      if (text) {
        setValue((prev) => (prev ? `${prev} ${text}` : text));
        requestAnimationFrame(autoResize);
        textareaRef.current?.focus();
      }
    }
  }

  return (
    <div className={styles.wrap}>
      {voice.errorMessage && <p className={styles.voiceError}>{voice.errorMessage}</p>}
      <div className={styles.row}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          placeholder="Message Chu Chu…"
          rows={1}
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            autoResize();
          }}
          onKeyDown={handleKeyDown}
        />
        {voiceEnabled && <VoicePulse status={voice.status} onPress={handleVoicePress} />}
        <button
          className={styles.sendButton}
          onClick={handleSend}
          disabled={disabled || !value.trim()}
          aria-label="Send message"
        >
          <ArrowUp size={16} />
        </button>
      </div>
      <p className={styles.hint}>Enter to send · Shift+Enter for a new line</p>
    </div>
  );
}
