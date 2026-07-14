import type {
  AppSettings,
  AutomationAction,
  ChatHistoryItem,
  HealthResponse,
  Note,
  Reminder,
  SearchResponse,
} from "@/types";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:8000").replace(/\/$/, "");
const SHARED_SECRET = import.meta.env.VITE_APP_SHARED_SECRET || "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function authHeaders(): Record<string, string> {
  return SHARED_SECRET ? { "X-Chu-Key": SHARED_SECRET } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(),
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    let detail = body;
    try {
      detail = JSON.parse(body).detail ?? body;
    } catch {
      /* body wasn't JSON — use it as-is */
    }
    throw new ApiError(res.status, detail || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  health: () => request<HealthResponse>("/health"),

  notes: {
    list: (q?: string) => request<Note[]>(`/api/notes${q ? `?q=${encodeURIComponent(q)}` : ""}`),
    create: (payload: { title: string; content: string; pinned?: boolean; tags?: string[] }) =>
      request<Note>("/api/notes", { method: "POST", body: JSON.stringify(payload) }),
    update: (
      id: string,
      payload: Partial<{ title: string; content: string; pinned: boolean; tags: string[] }>
    ) => request<Note>(`/api/notes/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    remove: (id: string) => request<void>(`/api/notes/${id}`, { method: "DELETE" }),
  },

  reminders: {
    list: (includeCompleted = true) =>
      request<Reminder[]>(`/api/reminders?include_completed=${includeCompleted}`),
    create: (payload: { title: string; notes?: string; due_at?: string | null; recurrence?: string }) =>
      request<Reminder>("/api/reminders", { method: "POST", body: JSON.stringify(payload) }),
    update: (id: string, payload: Record<string, unknown>) =>
      request<Reminder>(`/api/reminders/${id}`, { method: "PUT", body: JSON.stringify(payload) }),
    complete: (id: string) => request<Reminder>(`/api/reminders/${id}/complete`, { method: "POST" }),
    remove: (id: string) => request<void>(`/api/reminders/${id}`, { method: "DELETE" }),
  },

  history: {
    list: (conversationId = "default", limit = 50) =>
      request<ChatHistoryItem[]>(`/api/history?conversation_id=${conversationId}&limit=${limit}`),
    clear: (conversationId = "default") =>
      request<void>(`/api/history?conversation_id=${conversationId}`, { method: "DELETE" }),
  },

  settings: {
    get: () => request<{ values: AppSettings }>("/api/settings"),
    update: (values: Partial<AppSettings>) =>
      request<{ values: AppSettings }>("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ values }),
      }),
  },

  automation: {
    actions: () => request<{ actions: AutomationAction[] }>("/api/automation/actions"),
  },

  browser: {
    search: (q: string) => request<SearchResponse>(`/api/browser/search?q=${encodeURIComponent(q)}`),
    fetchSummary: (url: string) =>
      request<{ url: string; title: string; summary: string }>("/api/browser/fetch", {
        method: "POST",
        body: JSON.stringify({ url }),
      }),
  },

  voice: {
    transcribe: async (blob: Blob): Promise<{ text: string; provider: string }> => {
      const form = new FormData();
      form.append("file", blob, "recording.webm");
      const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
        method: "POST",
        // No Content-Type here — the browser sets the multipart boundary itself.
        headers: authHeaders(),
        body: form,
      });
      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new ApiError(res.status, body || res.statusText);
      }
      return res.json();
    },
  },
};

// --- Streaming chat ------------------------------------------------------------
// EventSource can't send custom headers or a POST body, so the SSE stream from
// POST /api/chat is parsed by hand off a fetch() ReadableStream instead. This
// mirrors the exact `event: X\ndata: Y\n\n` framing the backend's chat.py emits.

export interface SSEEvent {
  event: string;
  data: string;
}

function parseRawEvent(raw: string): SSEEvent | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of raw.split("\n")) {
    if (line.startsWith("event:")) event = line.slice("event:".length).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice("data:".length).trim());
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

async function* parseSSEStream(response: Response): AsyncGenerator<SSEEvent> {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let boundary = buffer.indexOf("\n\n");
      while (boundary !== -1) {
        const rawEvent = buffer.slice(0, boundary);
        buffer = buffer.slice(boundary + 2);
        const parsed = parseRawEvent(rawEvent);
        if (parsed) yield parsed;
        boundary = buffer.indexOf("\n\n");
      }
    }
    if (buffer.trim()) {
      const parsed = parseRawEvent(buffer);
      if (parsed) yield parsed;
    }
  } finally {
    reader.releaseLock();
  }
}

export async function* streamChat(
  message: string,
  conversationId = "default",
  signal?: AbortSignal
): AsyncGenerator<SSEEvent> {
  const res = await fetch(`${API_BASE}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify({ message, conversation_id: conversationId }),
    signal,
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new ApiError(res.status, body || res.statusText);
  }
  yield* parseSSEStream(res);
}

export function backendBaseUrl(): string {
  return API_BASE;
}
