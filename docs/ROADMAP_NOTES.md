# Roadmap → what shipped

The PRD's `Project_Roadmap.md` laid out five phases. Here's what each one means
in this codebase.

## Phase 1 — UI + AI ✅
- Electron + React shell: sidebar, chat panel, command palette (`⌘K` / `Ctrl+K`).
- Streaming chat against the Groq/Gemini/OpenRouter engine, with automatic
  provider failover (`backend/app/services/ai_provider.py`).
- Conversation history persisted per-conversation (`backend/app/routers/history.py`).

## Phase 2 — Voice ✅
- Push-to-talk voice input: local recording (`MediaRecorder`) → backend →
  Groq Whisper → transcript inserted into the chat box.
- Voice output via the OS's own TTS voices (`SpeechSynthesis`), toggleable in
  Settings.
- Why not local Whisper/pyttsx3 or the browser's `SpeechRecognition`: see
  `docs/ARCHITECTURE.md`.

## Phase 3 — Automation ✅ (scoped)
- A curated, confirmable action set runs locally in Electron: open an app,
  open a URL, take a screenshot, read/write the clipboard, check system info,
  open the Chu Chu workspace folder — see `frontend/electron/automation/`.
- The AI can *request* one of these actions (via a structured block in its
  reply); it can never execute one directly. The allowlist lives in
  `backend/app/services/automation_intents.py` and is mirrored for reference
  in `plugins/automation-skills/actions.json`.
- Full `pyautogui`-style arbitrary control and Playwright-driven browser
  automation are scoped as **local-only plugin extension points**
  (`plugins/automation-skills/`, `plugins/browser-skills/`) rather than
  built into the MVP — seeded, documented, and safe to build on, not
  fully wired up, since raw computer-control driven by a public-URL model
  deserves a deliberate choice rather than a default. See the "OS automation"
  section of `docs/ARCHITECTURE.md` for the reasoning.

## Phase 4 — Productivity ✅
- Notes (create/edit/pin/search) and Reminders (with due dates and simple
  recurrence) as first-class panels, backed by the `notes` / `reminders`
  tables from Database_Design.md.
- Lightweight web search + page summarization (`/api/browser/search`,
  `/api/browser/fetch`) for quick research without leaving the chat.
- The AI can create notes and reminders directly from conversation
  (e.g. "remind me to call mom at 6" → a `set_reminder` action).

## Phase 5 — Polish ✅
- A deliberate visual identity (see `docs/DESIGN.md`) rather than default
  component-library styling.
- Graceful cold-start handling in the UI when the free Render instance has
  spun down (a "waking up" state instead of a raw network error).
- Empty states, loading states, and confirmation dialogs throughout rather
  than only the happy path.
- Optional keep-warm scheduling (`.github/workflows/keep-warm.yml`) so the
  free backend feels closer to always-on during the hours you use it.

## Explicitly future (Future_Enhancements.md)
RAG over your notes, multi-agent workflows, and vision input are not in this
build. The provider-abstraction pattern in `ai_provider.py` and the
repository pattern in `repositories/` are structured so these can be added
without a rewrite — e.g. RAG would mean adding a `retrieval_repo.py` and a
step in `chat.py` that prepends relevant note snippets to the message list,
not a new architecture.
