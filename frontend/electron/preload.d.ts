import type { AutomationResult, SystemInfo } from "../src/types";

export interface ChuChuBridge {
  platform: string;
  window: {
    minimize: () => void;
    toggleMaximize: () => void;
    hide: () => void;
    isMaximized: () => Promise<boolean>;
    setAlwaysOnTop: (value: boolean) => void;
    setLaunchAtLogin: (value: boolean) => void;
  };
  automation: {
    openApp: (params: { name: string }) => Promise<AutomationResult>;
    openUrl: (params: { url: string }) => Promise<AutomationResult>;
    takeScreenshot: () => Promise<AutomationResult>;
    getSystemInfo: () => Promise<AutomationResult & { data?: SystemInfo }>;
    copyToClipboard: (params: { text: string }) => Promise<AutomationResult>;
    openWorkspace: () => Promise<AutomationResult>;
  };
}

declare global {
  interface Window {
    chuchu: ChuChuBridge;
  }
}

export {};
