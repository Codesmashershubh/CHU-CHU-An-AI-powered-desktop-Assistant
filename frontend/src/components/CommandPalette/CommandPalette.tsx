import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import {
  MessageSquare,
  StickyNote,
  BellRing,
  Settings,
  Trash2,
  FolderOpen,
  Search,
  type LucideIcon,
} from "lucide-react";
import { useChuChuStore } from "@/lib/store";
import styles from "./CommandPalette.module.css";

interface Command {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  run: () => void;
}

export function CommandPalette() {
  const open = useChuChuStore((s) => s.commandPaletteOpen);
  const setOpen = useChuChuStore((s) => s.setCommandPaletteOpen);
  const setActivePanel = useChuChuStore((s) => s.setActivePanel);
  const sendMessage = useChuChuStore((s) => s.sendMessage);
  const clearConversation = useChuChuStore((s) => s.clearConversation);

  const [query, setQuery] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setHighlighted(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const commands: Command[] = useMemo(
    () => [
      { id: "chat", label: "Go to Chat", icon: MessageSquare, run: () => setActivePanel("chat") },
      { id: "notes", label: "Go to Notes", icon: StickyNote, run: () => setActivePanel("notes") },
      { id: "reminders", label: "Go to Reminders", icon: BellRing, run: () => setActivePanel("reminders") },
      { id: "settings", label: "Go to Settings", icon: Settings, run: () => setActivePanel("settings") },
      {
        id: "clear",
        label: "Clear conversation",
        icon: Trash2,
        run: () => {
          clearConversation();
          setActivePanel("chat");
        },
      },
      {
        id: "workspace",
        label: "Open workspace folder",
        icon: FolderOpen,
        run: () => window.chuchu?.automation.openWorkspace(),
      },
    ],
    [setActivePanel, clearConversation]
  );

  const filtered = query.trim()
    ? commands.filter((c) => c.label.toLowerCase().includes(query.trim().toLowerCase()))
    : commands;

  const askOption: Command | null = query.trim()
    ? {
        id: "ask",
        label: `Ask Chu Chu: "${query.trim()}"`,
        icon: Search,
        run: () => {
          sendMessage(query.trim());
          setActivePanel("chat");
        },
      }
    : null;

  const allOptions = askOption ? [askOption, ...filtered] : filtered;

  function runAt(index: number) {
    const command = allOptions[index];
    if (!command) return;
    command.run();
    setOpen(false);
  }

  function handleKeyDown(event: ReactKeyboardEvent) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlighted((h) => Math.min(h + 1, allOptions.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      runAt(highlighted);
    }
  }

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={() => setOpen(false)}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.inputRow}>
          <Search size={15} className={styles.searchIcon} />
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search actions, or type a message to ask Chu Chu…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setHighlighted(0);
            }}
            onKeyDown={handleKeyDown}
          />
          <kbd className={styles.escHint}>ESC</kbd>
        </div>

        <div className={styles.list}>
          {allOptions.length === 0 ? (
            <p className={styles.empty}>No matching actions.</p>
          ) : (
            allOptions.map((command, index) => (
              <button
                key={command.id}
                className={`${styles.item} ${index === highlighted ? styles.itemActive : ""}`}
                onMouseEnter={() => setHighlighted(index)}
                onClick={() => runAt(index)}
              >
                <command.icon size={15} />
                <span>{command.label}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
