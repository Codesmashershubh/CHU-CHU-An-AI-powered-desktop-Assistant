import { create } from "zustand";
import { api, ApiError, streamChat } from "@/lib/api";
import { runAutomationAction } from "@/lib/automationRunner";
import type {
  AppSettings,
  ChatMessageVM,
  ConnectionState,
  Note,
  Reminder,
  ValidatedAction,
} from "@/types";

export type PanelId = "chat" | "notes" | "reminders" | "settings";

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

interface ChuChuState {
  // --- layout / navigation ---------------------------------------------------
  activePanel: PanelId;
  setActivePanel: (panel: PanelId) => void;
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;

  // --- connection --------------------------------------------------------------
  connectionState: ConnectionState;
  checkConnection: () => Promise<void>;

  // --- chat ----------------------------------------------------------------------
  messages: ChatMessageVM[];
  isSending: boolean;
  loadHistory: () => Promise<void>;
  sendMessage: (text: string) => Promise<void>;
  clearConversation: () => Promise<void>;
  resolveAction: (messageId: string, approved: boolean) => Promise<void>;

  // --- notes ------------------------------------------------------------------------
  notes: Note[];
  notesLoading: boolean;
  loadNotes: (query?: string) => Promise<void>;
  createNote: (title: string, content: string) => Promise<void>;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "content" | "pinned">>) => Promise<void>;
  deleteNote: (id: string) => Promise<void>;

  // --- reminders --------------------------------------------------------------------
  reminders: Reminder[];
  remindersLoading: boolean;
  loadReminders: () => Promise<void>;
  createReminder: (title: string, dueAt: string | null) => Promise<void>;
  completeReminder: (id: string) => Promise<void>;
  deleteReminder: (id: string) => Promise<void>;

  // --- settings -----------------------------------------------------------------------
  settings: AppSettings | null;
  loadSettings: () => Promise<void>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useChuChuStore = create<ChuChuState>((set, get) => ({
  activePanel: "chat",
  setActivePanel: (panel) => set({ activePanel: panel }),
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  commandPaletteOpen: false,
  setCommandPaletteOpen: (open) => set({ commandPaletteOpen: open }),

  connectionState: "checking",
  checkConnection: async () => {
    set({ connectionState: get().connectionState === "online" ? "online" : "checking" });
    try {
      await api.health();
      set({ connectionState: "online" });
    } catch {
      // Distinguish "still asleep, wait for it" from a harder failure by
      // retrying once briefly — Render free instances take ~30-60s to wake.
      set({ connectionState: "waking" });
    }
  },

  messages: [],
  isSending: false,

  loadHistory: async () => {
    try {
      const items = await api.history.list();
      set({
        messages: items.map((m) => ({
          id: m.id,
          role: m.role,
          content: m.content,
          status: "done",
          provider: m.provider,
          createdAt: m.created_at,
        })),
      });
    } catch {
      // First run / offline — an empty transcript is a perfectly fine start.
    }
  },

  sendMessage: async (text) => {
    const trimmed = text.trim();
    if (!trimmed || get().isSending) return;

    const userMsg: ChatMessageVM = {
      id: newId(),
      role: "user",
      content: trimmed,
      status: "done",
      createdAt: new Date().toISOString(),
    };
    const assistantId = newId();
    const assistantMsg: ChatMessageVM = {
      id: assistantId,
      role: "assistant",
      content: "",
      status: "streaming",
      createdAt: new Date().toISOString(),
    };

    set((s) => ({ messages: [...s.messages, userMsg, assistantMsg], isSending: true }));

    try {
      for await (const evt of streamChat(trimmed)) {
        if (evt.event === "token") {
          const { content } = JSON.parse(evt.data) as { content: string };
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, content: m.content + content } : m
            ),
          }));
        } else if (evt.event === "action") {
          const action = JSON.parse(evt.data) as ValidatedAction;
          set((s) => ({
            messages: s.messages.map((m) => (m.id === assistantId ? { ...m, pendingAction: action } : m)),
          }));
          if (!action.requires_confirmation) {
            await get().resolveAction(assistantId, true);
          }
        } else if (evt.event === "done") {
          const { provider } = JSON.parse(evt.data) as { provider: string | null };
          set((s) => ({
            messages: s.messages.map((m) => (m.id === assistantId ? { ...m, status: "done", provider } : m)),
          }));
        } else if (evt.event === "error") {
          const { message } = JSON.parse(evt.data) as { message: string };
          set((s) => ({
            messages: s.messages.map((m) =>
              m.id === assistantId ? { ...m, status: "error", errorMessage: message } : m
            ),
          }));
        }
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't reach Chu Chu's backend.";
      set((s) => ({
        messages: s.messages.map((m) => (m.id === assistantId ? { ...m, status: "error", errorMessage: message } : m)),
      }));
      get().checkConnection();
    } finally {
      set({ isSending: false });
    }
  },

  clearConversation: async () => {
    await api.history.clear();
    set({ messages: [] });
  },

  resolveAction: async (messageId, approved) => {
    const message = get().messages.find((m) => m.id === messageId);
    const action = message?.pendingAction;
    if (!action) return;

    if (!approved) {
      set((s) => ({ messages: s.messages.map((m) => (m.id === messageId ? { ...m, pendingAction: undefined } : m)) }));
      return;
    }

    const result = await runAutomationAction(action);

    set((s) => ({
      messages: s.messages.map((m) =>
        m.id === messageId
          ? {
              ...m,
              pendingAction: undefined,
              content: m.content + (m.content.endsWith("\n") || !m.content ? "" : "\n\n") + `→ ${result.message}`,
            }
          : m
      ),
    }));

    // A few actions touch data the app already shows elsewhere — refresh it.
    if (action.action === "create_note") get().loadNotes();
    if (action.action === "set_reminder") get().loadReminders();
  },

  notes: [],
  notesLoading: false,
  loadNotes: async (query) => {
    set({ notesLoading: true });
    try {
      const notes = await api.notes.list(query);
      set({ notes });
    } finally {
      set({ notesLoading: false });
    }
  },
  createNote: async (title, content) => {
    const note = await api.notes.create({ title, content });
    set((s) => ({ notes: [note, ...s.notes] }));
  },
  updateNote: async (id, patch) => {
    const note = await api.notes.update(id, patch);
    set((s) => ({ notes: s.notes.map((n) => (n.id === id ? note : n)) }));
  },
  deleteNote: async (id) => {
    await api.notes.remove(id);
    set((s) => ({ notes: s.notes.filter((n) => n.id !== id) }));
  },

  reminders: [],
  remindersLoading: false,
  loadReminders: async () => {
    set({ remindersLoading: true });
    try {
      const reminders = await api.reminders.list();
      set({ reminders });
    } finally {
      set({ remindersLoading: false });
    }
  },
  createReminder: async (title, dueAt) => {
    const reminder = await api.reminders.create({ title, due_at: dueAt });
    set((s) => ({ reminders: [...s.reminders, reminder] }));
  },
  completeReminder: async (id) => {
    const reminder = await api.reminders.complete(id);
    set((s) => ({ reminders: s.reminders.map((r) => (r.id === id ? reminder : r)) }));
  },
  deleteReminder: async (id) => {
    await api.reminders.remove(id);
    set((s) => ({ reminders: s.reminders.filter((r) => r.id !== id) }));
  },

  settings: null,
  loadSettings: async () => {
    const { values } = await api.settings.get();
    set({ settings: values });
  },
  updateSettings: async (patch) => {
    const { values } = await api.settings.update(patch);
    set({ settings: values });
  },
}));
