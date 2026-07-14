import { LogoMark } from "@/components/shared/LogoMark";
import { ActionConfirmCard } from "./ActionConfirmCard";
import type { ChatMessageVM } from "@/types";
import styles from "./MessageBubble.module.css";

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  } catch {
    return "";
  }
}

export function MessageBubble({ message }: { message: ChatMessageVM }) {
  if (message.role === "user") {
    return (
      <div className={styles.userRow}>
        <div className={`${styles.userCard} chu-selectable`}>
          <p className={styles.text}>{message.content}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.assistantRow}>
      <div className={styles.assistantHeader}>
        <LogoMark size={14} animated={message.status === "streaming" && message.content.length === 0} />
        <span className={styles.assistantName}>Chu Chu</span>
        <span className={styles.timestamp}>{formatTime(message.createdAt)}</span>
        {message.provider && <span className={styles.providerTag}>{message.provider}</span>}
      </div>

      <div className={`${styles.assistantContent} chu-selectable`}>
        {message.content ? (
          <p className={styles.text}>{message.content}</p>
        ) : message.status === "streaming" ? (
          <p className={styles.thinking}>thinking…</p>
        ) : null}

        {message.status === "error" && (
          <p className={styles.error}>{message.errorMessage || "Something went wrong."}</p>
        )}
      </div>

      {message.pendingAction && <ActionConfirmCard messageId={message.id} action={message.pendingAction} />}
    </div>
  );
}
