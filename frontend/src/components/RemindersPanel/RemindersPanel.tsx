import { useEffect, useState } from "react";
import { BellRing, Check, Trash2, Plus } from "lucide-react";
import { useChuChuStore } from "@/lib/store";
import { EmptyState } from "@/components/shared/EmptyState";
import { IconButton } from "@/components/shared/IconButton";
import type { Reminder } from "@/types";
import styles from "./RemindersPanel.module.css";

function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const datePart = isToday
    ? "Today"
    : date.toLocaleDateString([], { month: "short", day: "numeric" });
  const timePart = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function isOverdue(reminder: Reminder): boolean {
  if (!reminder.due_at || reminder.completed) return false;
  return new Date(reminder.due_at).getTime() < Date.now();
}

export function RemindersPanel() {
  const reminders = useChuChuStore((s) => s.reminders);
  const loading = useChuChuStore((s) => s.remindersLoading);
  const loadReminders = useChuChuStore((s) => s.loadReminders);
  const createReminder = useChuChuStore((s) => s.createReminder);
  const completeReminder = useChuChuStore((s) => s.completeReminder);
  const deleteReminder = useChuChuStore((s) => s.deleteReminder);

  const [title, setTitle] = useState("");
  const [dueAt, setDueAt] = useState("");

  useEffect(() => {
    loadReminders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    if (!title.trim()) return;
    await createReminder(title.trim(), dueAt ? new Date(dueAt).toISOString() : null);
    setTitle("");
    setDueAt("");
  }

  const pending = reminders.filter((r) => !r.completed).sort((a, b) => {
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  });
  const completed = reminders.filter((r) => r.completed);

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Reminders</h2>
      </div>

      <div className={styles.composer}>
        <input
          className={styles.titleInput}
          placeholder="Remind me to…"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreate()}
        />
        <input
          className={styles.dateInput}
          type="datetime-local"
          value={dueAt}
          onChange={(e) => setDueAt(e.target.value)}
        />
        <IconButton aria-label="Add reminder" onClick={handleCreate}>
          <Plus size={16} />
        </IconButton>
      </div>

      <div className={styles.scroll}>
        {!loading && reminders.length === 0 ? (
          <EmptyState
            icon={<BellRing size={22} />}
            title="Nothing on the list"
            description='Add one above, or ask Chu Chu — "remind me to call mom at 6" works.'
          />
        ) : (
          <>
            {pending.length > 0 && (
              <ul className={styles.list}>
                {pending.map((reminder) => (
                  <li key={reminder.id} className={styles.item}>
                    <button
                      className={styles.checkbox}
                      aria-label="Complete reminder"
                      onClick={() => completeReminder(reminder.id)}
                    />
                    <div className={styles.itemBody}>
                      <span className={styles.itemTitle}>{reminder.title}</span>
                      <span className={`${styles.itemDue} ${isOverdue(reminder) ? styles.overdue : ""}`}>
                        {formatDue(reminder.due_at)}
                      </span>
                    </div>
                    <IconButton aria-label="Delete reminder" onClick={() => deleteReminder(reminder.id)}>
                      <Trash2 size={14} />
                    </IconButton>
                  </li>
                ))}
              </ul>
            )}

            {completed.length > 0 && (
              <div className={styles.completedSection}>
                <p className={styles.completedLabel}>Completed</p>
                <ul className={styles.list}>
                  {completed.map((reminder) => (
                    <li key={reminder.id} className={`${styles.item} ${styles.itemDone}`}>
                      <span className={styles.checkboxDone}>
                        <Check size={11} />
                      </span>
                      <div className={styles.itemBody}>
                        <span className={styles.itemTitle}>{reminder.title}</span>
                      </div>
                      <IconButton aria-label="Delete reminder" onClick={() => deleteReminder(reminder.id)}>
                        <Trash2 size={14} />
                      </IconButton>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
