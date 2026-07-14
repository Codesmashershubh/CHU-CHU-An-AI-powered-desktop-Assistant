import { useEffect } from "react";
import { TitleBar } from "@/components/TitleBar/TitleBar";
import { Sidebar } from "@/components/Sidebar/Sidebar";
import { ChatPanel } from "@/components/ChatPanel/ChatPanel";
import { NotesPanel } from "@/components/NotesPanel/NotesPanel";
import { RemindersPanel } from "@/components/RemindersPanel/RemindersPanel";
import { SettingsPanel } from "@/components/SettingsPanel/SettingsPanel";
import { CommandPalette } from "@/components/CommandPalette/CommandPalette";
import { useChuChuStore } from "@/lib/store";
import { useGlobalHotkeys } from "@/hooks/useGlobalHotkeys";
import styles from "./App.module.css";

const CONNECTION_POLL_MS = 45_000;

export default function App() {
  const activePanel = useChuChuStore((s) => s.activePanel);
  const checkConnection = useChuChuStore((s) => s.checkConnection);
  const loadReminders = useChuChuStore((s) => s.loadReminders);

  useGlobalHotkeys();

  useEffect(() => {
    checkConnection();
    loadReminders();
    const interval = setInterval(checkConnection, CONNECTION_POLL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.shell}>
      <TitleBar />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.main}>
          {activePanel === "chat" && <ChatPanel />}
          {activePanel === "notes" && <NotesPanel />}
          {activePanel === "reminders" && <RemindersPanel />}
          {activePanel === "settings" && <SettingsPanel />}
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}
