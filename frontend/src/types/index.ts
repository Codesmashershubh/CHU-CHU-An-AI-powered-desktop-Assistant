// Mirrors backend/app/models/schemas.py. Kept as plain types (not generated)
// since the surface is small and stable — see docs/ARCHITECTURE.md for why
// the repo generally prefers small deliberate duplication over cross-package
// build coupling in a few specific, documented places like this one.

export type Role = "user" | "assistant" | "system";

export interface ChatHistoryItem {
  id: string;
  role: Role;
  content: string;
  provider: string | null;
  created_at: string;
}

export interface Note {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface Reminder {
  id: string;
  title: string;
  notes: string;
  due_at: string | null;
  recurrence: "none" | "daily" | "weekly" | "monthly";
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface AppSettings {
  assistant_name: string;
  theme: string;
  voice_enabled: boolean;
  voice_output_enabled: boolean;
  wake_word_enabled: boolean;
  always_on_top: boolean;
  launch_at_login: boolean;
  [key: string]: unknown;
}

export interface AutomationAction {
  action: string;
  description: string;
  params: Record<string, string>;
  requires_confirmation: boolean;
}

export interface ValidatedAction {
  action: string;
  params: Record<string, string>;
  confirm_text: string;
  requires_confirmation: boolean;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
  answer: string | null;
  provider: string;
}

export interface HealthResponse {
  status: "ok";
  app: string;
  environment: string;
  providers_configured: string[];
}

// --- Chat panel view-model (not a backend type — how the UI represents a
// streaming reply-in-progress before it's a finished ChatHistoryItem) --------

export type MessageStatus = "pending" | "streaming" | "done" | "error";

export interface ChatMessageVM {
  id: string;
  role: Role;
  content: string;
  status: MessageStatus;
  provider?: string | null;
  pendingAction?: ValidatedAction;
  errorMessage?: string;
  createdAt: string;
}

export type ConnectionState = "checking" | "online" | "waking" | "offline";

// --- Electron bridge (window.chuchu, exposed by electron/preload.js) --------
// Canonical home for these types — electron/preload.d.ts imports them back,
// rather than the other way around, so `src/` never reaches into `electron/`.

export interface SystemInfo {
  platform: string;
  arch: string;
  osVersion: string;
  totalMemoryGB: number;
  freeMemoryGB: number;
  memoryUsedPercent: number;
  uptimeHours: number;
  cpuModel: string;
}

export interface AutomationResult {
  ok: boolean;
  message: string;
  data?: unknown;
}
