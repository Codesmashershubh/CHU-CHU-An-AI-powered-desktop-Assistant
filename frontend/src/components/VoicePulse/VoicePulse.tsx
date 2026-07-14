import { Mic, Loader2 } from "lucide-react";
import type { VoiceStatus } from "@/hooks/useVoice";
import styles from "./VoicePulse.module.css";

interface VoicePulseProps {
  status: VoiceStatus;
  onPress: () => void;
}

export function VoicePulse({ status, onPress }: VoicePulseProps) {
  const label =
    status === "recording"
      ? "Stop recording"
      : status === "transcribing"
        ? "Transcribing…"
        : "Start voice input";

  return (
    <button
      type="button"
      className={`${styles.button} ${status === "recording" ? styles.recording : ""}`}
      onClick={onPress}
      disabled={status === "transcribing"}
      aria-label={label}
      title={label}
    >
      {status === "transcribing" ? (
        <Loader2 size={16} className={styles.spin} />
      ) : status === "recording" ? (
        <span className={styles.bars} aria-hidden="true">
          <span />
          <span />
          <span />
          <span />
        </span>
      ) : (
        <Mic size={16} />
      )}
    </button>
  );
}
