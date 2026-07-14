import { useState } from "react";
import { ShieldAlert, Check, X } from "lucide-react";
import { useChuChuStore } from "@/lib/store";
import type { ValidatedAction } from "@/types";
import styles from "./ActionConfirmCard.module.css";

export function ActionConfirmCard({ messageId, action }: { messageId: string; action: ValidatedAction }) {
  const resolveAction = useChuChuStore((s) => s.resolveAction);
  const [busy, setBusy] = useState(false);

  async function handle(approved: boolean) {
    setBusy(true);
    await resolveAction(messageId, approved);
    setBusy(false);
  }

  return (
    <div className={styles.card}>
      <div className={styles.header}>
        <ShieldAlert size={14} />
        <span>{action.confirm_text}</span>
      </div>
      <div className={styles.actions}>
        <button className={styles.decline} onClick={() => handle(false)} disabled={busy}>
          <X size={13} />
          Not now
        </button>
        <button className={styles.approve} onClick={() => handle(true)} disabled={busy}>
          <Check size={13} />
          {busy ? "Running…" : "Allow"}
        </button>
      </div>
    </div>
  );
}
