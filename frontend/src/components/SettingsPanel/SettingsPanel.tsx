import { useEffect, useState } from "react";
import { Info } from "lucide-react";
import { useChuChuStore } from "@/lib/store";
import { api, backendBaseUrl } from "@/lib/api";
import type { HealthResponse } from "@/types";
import styles from "./SettingsPanel.module.css";

function ToggleRow({
  label,
  description,
  checked,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className={styles.row}>
      <div>
        <p className={styles.rowLabel}>{label}</p>
        <p className={styles.rowDescription}>{description}</p>
      </div>
      <button
        role="switch"
        aria-checked={checked}
        className={`${styles.toggle} ${checked ? styles.toggleOn : ""}`}
        onClick={() => onChange(!checked)}
      >
        <span className={styles.toggleKnob} />
      </button>
    </div>
  );
}

export function SettingsPanel() {
  const settings = useChuChuStore((s) => s.settings);
  const loadSettings = useChuChuStore((s) => s.loadSettings);
  const updateSettings = useChuChuStore((s) => s.updateSettings);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState(false);

  useEffect(() => {
    loadSettings();
    api
      .health()
      .then(setHealth)
      .catch(() => setHealthError(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the real window in sync with the persisted preference — this runs
  // on every settings change, including the very first load, so the window
  // actually reflects the setting on startup too, not just after a toggle.
  useEffect(() => {
    if (settings) window.chuchu?.window.setAlwaysOnTop(settings.always_on_top);
  }, [settings?.always_on_top]);

  if (!settings) {
    return <div className={styles.panel} />;
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.title}>Settings</h2>
      </div>

      <div className={styles.scroll}>
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Persona</h3>
          <div className={styles.row}>
            <div>
              <p className={styles.rowLabel}>Assistant name</p>
              <p className={styles.rowDescription}>What Chu Chu calls itself in conversation.</p>
            </div>
            <input
              className={styles.nameInput}
              value={settings.assistant_name}
              onChange={(e) => updateSettings({ assistant_name: e.target.value })}
            />
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Voice</h3>
          <ToggleRow
            label="Voice input"
            description="Show the microphone button in chat."
            checked={settings.voice_enabled}
            onChange={(v) => updateSettings({ voice_enabled: v })}
          />
          <ToggleRow
            label="Speak replies aloud"
            description="Use your system's text-to-speech voices for Chu Chu's replies."
            checked={settings.voice_output_enabled}
            onChange={(v) => updateSettings({ voice_output_enabled: v })}
          />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Window</h3>
          <ToggleRow
            label="Always on top"
            description="Keep Chu Chu above other windows."
            checked={settings.always_on_top}
            onChange={(v) => {
              updateSettings({ always_on_top: v });
              window.chuchu?.window.setAlwaysOnTop(v);
            }}
          />
          <ToggleRow
            label="Launch at login"
            description="Start Chu Chu automatically when you log in."
            checked={settings.launch_at_login}
            onChange={(v) => {
              updateSettings({ launch_at_login: v });
              window.chuchu?.window.setLaunchAtLogin(v);
            }}
          />
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Backend</h3>
          <div className={styles.infoBox}>
            <Info size={14} />
            <div>
              <p className={styles.infoLine}>
                <span className={styles.infoKey}>Connected to</span>
                <span className={styles.mono}>{backendBaseUrl()}</span>
              </p>
              {healthError ? (
                <p className={styles.infoLine}>Couldn't reach the backend right now.</p>
              ) : health ? (
                <>
                  <p className={styles.infoLine}>
                    <span className={styles.infoKey}>AI providers</span>
                    <span className={styles.mono}>
                      {health.providers_configured.length > 0
                        ? health.providers_configured.join(", ")
                        : "none configured"}
                    </span>
                  </p>
                  <p className={styles.infoLine}>
                    <span className={styles.infoKey}>Environment</span>
                    <span className={styles.mono}>{health.environment}</span>
                  </p>
                </>
              ) : (
                <p className={styles.infoLine}>Checking…</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
