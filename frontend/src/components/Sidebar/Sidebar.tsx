import type { ReactNode } from "react";
import { MessageSquare, StickyNote, BellRing, Settings, Command, FolderOpen } from "lucide-react";
import { useChuChuStore, type PanelId } from "@/lib/store";
import styles from "./Sidebar.module.css";

interface NavItem {
  id: PanelId;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { id: "chat", label: "Chat", icon: <MessageSquare size={17} /> },
  { id: "notes", label: "Notes", icon: <StickyNote size={17} /> },
  { id: "reminders", label: "Reminders", icon: <BellRing size={17} /> },
  { id: "settings", label: "Settings", icon: <Settings size={17} /> },
];

export function Sidebar() {
  const activePanel = useChuChuStore((s) => s.activePanel);
  const setActivePanel = useChuChuStore((s) => s.setActivePanel);
  const collapsed = useChuChuStore((s) => s.sidebarCollapsed);
  const setCommandPaletteOpen = useChuChuStore((s) => s.setCommandPaletteOpen);
  const reminders = useChuChuStore((s) => s.reminders);

  const dueSoonCount = reminders.filter((r) => !r.completed).length;

  return (
    <nav className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <button
        className={styles.paletteButton}
        onClick={() => setCommandPaletteOpen(true)}
        title="Command palette"
      >
        <Command size={15} />
        {!collapsed && <span>Quick action</span>}
        {!collapsed && <kbd className={styles.kbd}>⌘K</kbd>}
      </button>

      <div className={styles.navList}>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={`${styles.navItem} ${activePanel === item.id ? styles.active : ""}`}
            onClick={() => setActivePanel(item.id)}
            title={item.label}
          >
            <span className={styles.navIcon}>{item.icon}</span>
            {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
            {item.id === "reminders" && dueSoonCount > 0 && (
              <span className={styles.badge}>{dueSoonCount}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        <button
          className={styles.navItem}
          onClick={() => window.chuchu?.automation.openWorkspace()}
          title="Open workspace folder"
        >
          <span className={styles.navIcon}>
            <FolderOpen size={17} />
          </span>
          {!collapsed && <span className={styles.navLabel}>Workspace</span>}
        </button>
      </div>
    </nav>
  );
}
