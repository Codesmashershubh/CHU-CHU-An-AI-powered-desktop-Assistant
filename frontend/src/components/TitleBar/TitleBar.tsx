import { useEffect, useState } from "react";
import { Minus, Square, X, PanelLeftClose, PanelLeft } from "lucide-react";
import { LogoMark } from "@/components/shared/LogoMark";
import { ConnectionBadge } from "@/components/shared/ConnectionBadge";
import { IconButton } from "@/components/shared/IconButton";
import { useChuChuStore } from "@/lib/store";
import styles from "./TitleBar.module.css";

export function TitleBar() {
  const sidebarCollapsed = useChuChuStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useChuChuStore((s) => s.toggleSidebar);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(window.chuchu?.platform === "darwin");
  }, []);

  const hasBridge = typeof window !== "undefined" && !!window.chuchu;

  return (
    <header className={`${styles.titlebar} chu-drag-region`} style={{ paddingLeft: isMac ? 78 : 12 }}>
      <div className={`${styles.left} chu-no-drag`}>
        <IconButton aria-label="Toggle sidebar" onClick={toggleSidebar}>
          {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
        </IconButton>
        <div className={styles.brand}>
          <LogoMark size={16} />
          <span>Chu Chu</span>
        </div>
      </div>

      <div className={`${styles.right} chu-no-drag`}>
        <ConnectionBadge />
        {hasBridge && !isMac && (
          <div className={styles.windowControls}>
            <IconButton aria-label="Minimize" onClick={() => window.chuchu.window.minimize()}>
              <Minus size={14} />
            </IconButton>
            <IconButton aria-label="Maximize" onClick={() => window.chuchu.window.toggleMaximize()}>
              <Square size={12} />
            </IconButton>
            <IconButton
              aria-label="Close"
              variant="danger"
              onClick={() => window.chuchu.window.hide()}
              title="Hides Chu Chu — quit fully from the tray icon"
            >
              <X size={14} />
            </IconButton>
          </div>
        )}
      </div>
    </header>
  );
}
