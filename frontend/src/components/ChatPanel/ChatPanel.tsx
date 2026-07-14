import { useEffect, useRef } from "react";
import { MessageCircle, Trash2 } from "lucide-react";
import { useChuChuStore } from "@/lib/store";
import { useSpeakReplies } from "@/hooks/useSpeakReplies";
import { MessageBubble } from "./MessageBubble";
import { ChatInput } from "./ChatInput";
import { EmptyState } from "@/components/shared/EmptyState";
import { IconButton } from "@/components/shared/IconButton";
import styles from "./ChatPanel.module.css";

export function ChatPanel() {
  const messages = useChuChuStore((s) => s.messages);
  const isSending = useChuChuStore((s) => s.isSending);
  const sendMessage = useChuChuStore((s) => s.sendMessage);
  const clearConversation = useChuChuStore((s) => s.clearConversation);
  const loadHistory = useChuChuStore((s) => s.loadHistory);
  const voiceOutputEnabled = useChuChuStore((s) => s.settings?.voice_output_enabled ?? false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useSpeakReplies(messages, voiceOutputEnabled);

  useEffect(() => {
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Chat</h2>
        <IconButton aria-label="Clear conversation" onClick={() => clearConversation()} title="Clear conversation">
          <Trash2 size={15} />
        </IconButton>
      </div>

      <div className={styles.scroll} ref={scrollRef}>
        {messages.length === 0 ? (
          <EmptyState
            icon={<MessageCircle size={28} />}
            title="Say something to Chu Chu"
            description="Ask a question, get it to jot down a note, set a reminder, or just talk through something you're working on."
          />
        ) : (
          <div className={styles.messages}>
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} />
            ))}
          </div>
        )}
      </div>

      <ChatInput onSend={sendMessage} disabled={isSending} />
    </div>
  );
}
