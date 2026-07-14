import { Wifi, WifiOff, Loader2 } from "lucide-react";
import { useChuChuStore } from "@/lib/store";
import styles from "./ConnectionBadge.module.css";

const COPY: Record<string, { label: string; icon: JSX.Element; tone: string }> = {
  checking: { label: "Connecting…", icon: <Loader2 size={12} className={styles.spin} />, tone: "muted" },
  waking: { label: "Waking up Chu Chu…", icon: <Loader2 size={12} className={styles.spin} />, tone: "brass" },
  online: { label: "Online", icon: <Wifi size={12} />, tone: "signal" },
  offline: { label: "Offline", icon: <WifiOff size={12} />, tone: "danger" },
};

export function ConnectionBadge() {
  const connectionState = useChuChuStore((s) => s.connectionState);
  const copy = COPY[connectionState];

  return (
    <div className={`${styles.badge} ${styles[copy.tone]}`} title="Chu Chu's backend connection status">
      {copy.icon}
      <span>{copy.label}</span>
    </div>
  );
}
