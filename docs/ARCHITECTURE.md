# Chu Chu — Architecture &amp; Decisions

This document exists because the original PRD's `Tech_Stack.md` (React, Electron,
FastAPI, Python, SQLite, **Ollama (3B)**, Playwright, pyautogui, Whisper, pyttsx3)
and this build's actual constraints (free resources only, backend *and* AI engine
on Render's free tier, works well on an 8GB laptop) pull in different directions
in a few places. Rather than silently drop or reinterpret pieces of the spec,
here's exactly what changed, and why.

## The core tension

Render's free web service gives you **512MB RAM and 0.1 CPU**, with an ephemeral
filesystem that resets on every redeploy. Ollama running even a small 3B model
needs several times that RAM just to load the weights, before it's answered a
single question. **Ollama cannot run on Render's free tier — full stop, not as a
matter of tuning, but as a matter of the model not fitting in the box.**

That's actually good news once you notice the second half of the brief: this
also needs to work well on an 8GB laptop. Loading a 3B model locally eats
2–4GB of that laptop's RAM for as long as Chu Chu is open, competing with
whatever else you're running. **The fix for "fits on Render's free tier" and the
fix for "stays light on an 8GB laptop" turn out to be the exact same fix:**
don't run inference anywhere locally-constrained at all. Call a free hosted
inference API instead, and let Chu Chu itself — the Electron app — stay small.

## Decisions, one by one

### AI engine: hosted APIs, not Ollama
The backend calls **Groq** (primary — free, no credit card, extremely fast,
serves Llama 3.3 70B, which is a meaningfully stronger model than a local 3B
would ever be) over plain HTTPS, with automatic failover to **Gemini** and then
**OpenRouter's free models** if Groq is unavailable or rate-limited. No model
ever runs in the backend process — `services/ai_provider.py` is a thin HTTP
client, which is also *why* it fits in 512MB: there's no model weights, no
tensor runtime, nothing but request/response plumbing.

This is a strict upgrade on both axes the brief cares about: a bigger, better
model, and a smaller local footprint. The trade-off is an internet dependency
Ollama wouldn't have had — Chu Chu's chat needs a network connection. Given the
backend is a cloud service anyway, this was already true.

### Voice input: MediaRecorder + hosted Whisper, not local Whisper + pyttsx3
Two independent reasons pushed the same direction here:

1. Local Whisper needs real CPU/RAM Render's free tier doesn't have.
2. **Electron can't use the browser's built-in speech recognition at all.**
   Chromium's `SpeechRecognition` API calls a Google web service that's only
   provisioned for Chrome-branded builds; in Electron it reliably throws a
   `network` / `not-allowed` error
   ([electron/electron#46143](https://github.com/electron/electron/issues/46143),
   open for years). This isn't a configuration problem to work around — it
   doesn't work in any Electron app.

So voice input records locally with `MediaRecorder` (which *does* work fine in
Electron — it's local media capture, no Google service involved) and ships the
audio to the backend, which forwards it to **Groq's free hosted Whisper
endpoint**. Same API key as chat, no separate signup, no local ML runtime.

Voice *output* (text-to-speech) goes the other way: the Web Speech API's
`SpeechSynthesis` (unlike `SpeechRecognition`) uses the OS's own installed
voices and works fine in Electron, so that runs entirely client-side for free,
with no backend involvement — pyttsx3's job, done by the platform instead of a
bundled Python dependency.

### OS automation: a curated local action set, not raw pyautogui
This one's a safety decision as much as a technical one. The AI engine lives on
a public Render URL and takes free-text input from a chat box. If that engine
could, even indirectly, drive raw mouse/keyboard input or shell commands, you'd
have built a remote-control surface for your own computer that anyone who found
your URL could try to steer. That's not a hypothetical to design around
casually — it's the whole reason this document calls out the pattern:

- The AI **never executes anything**. It can only emit a structured request
  (`open_app`, `set_reminder`, `search_web`, …) from a fixed allowlist defined
  in `backend/app/services/automation_intents.py`.
- The backend validates that request against a strict schema and drops
  anything malformed or not on the list — it still doesn't execute it either.
- The validated request is sent to the Electron client as data. **Only the
  Electron app, running locally on your machine, ever actually calls an OS
  API** — and for anything that changes something (opening an app, hitting a
  URL, touching the clipboard, taking a screenshot), it shows you a
  confirmation dialog first. See `frontend/electron/automation/`.

Raw `pyautogui`-style coordinate clicking driven by freeform model output is a
plausible design for a *fully local, single-machine* tool with no network
exposure. It's a bad fit here specifically because the brain directing those
actions is a cloud service. If you later run Chu Chu's backend somewhere
private with no public exposure, `plugins/automation-skills/` documents how to
extend the allowlist with broader capabilities (Playwright, `nut-js` for real
keyboard/mouse control, etc.) — the seam is there on purpose.

### Browser automation: lightweight fetch server-side, Playwright stays local
A headless browser is 300MB+ of binaries and needs more RAM than Render's free
tier has to spare — it doesn't belong in the cloud half of this app. The
`/api/browser` endpoints do a plain HTTP GET + HTML-to-text extraction
(`services/page_reader.py`) for "fetch this page and summarize it," which
covers most of what people actually want and costs near-zero memory. Real
browser automation (clicking through a logged-in session, filling forms) is
scoped as a **local, Electron-side** plugin using Node's Playwright — see
`plugins/browser-skills/` — consistent with the Roadmap's Phase 3, and
consistent with automation generally living on your machine, not a public URL.

### Database: SQLAlchemy over SQLite *or* Postgres, not a hard SQLite requirement
The PRD calls for SQLite, and the app still speaks SQLite by default — zero
setup, `sqlite+aiosqlite:///./data/chuchu.db`, works immediately. The wrinkle
is Render's free tier: **the filesystem is ephemeral**, so a SQLite file there
gets wiped on every redeploy and restart. Render's own free Postgres isn't a
fix either — it expires 30 days after creation.

Rather than pick one imperfect option, `DATABASE_URL` is a single environment
variable that switches backends with zero code changes (via SQLAlchemy's async
engine): SQLite for local development, or a free, non-expiring Postgres
instance (Neon is the recommended option — see `docs/DEPLOYMENT.md`) for
production data that actually survives a redeploy. Notes, reminders, chat
history, and settings are the same four tables the PRD specified either way.

### Rate limiting &amp; a shared-secret header, not full auth
Chu Chu is a single-user personal assistant, not a multi-tenant product — real
authentication would be solving a problem this app doesn't have. But a Render
free URL is still a *public* URL, and anything that finds it can burn through
your free AI-provider quota. `APP_SHARED_SECRET` (a header the Electron app
sends, checked in `core/security.py`) and a small in-memory rate limiter
(`core/ratelimit.py`) exist to close that gap cheaply, not to gate access
between "users" of the app.

## What stayed exactly as specified
- **FastAPI + Python** backend, deployed as the PRD's primary backend.
- **React + Electron** desktop shell with a dark UI, sidebar, chat panel, and
  command palette (UI_UX_Guidelines.md, followed structurally as written).
- **SQLite-compatible** storage model with the exact table set from
  Database_Design.md: `users` (optional), `notes`, `reminders`, `history`,
  `settings`.
- The five-phase roadmap (UI+AI → Voice → Automation → Productivity → Polish)
  — this build delivers all five, scoped to what's safely buildable for free;
  `docs/ROADMAP_NOTES.md` maps each phase to what shipped.
- **MIT license**, `frontend/` + `backend/` + `plugins/` + `docs/` layout, as
  specified in Folder_Structure.md.

## Cost ledger (what's actually free, and the ceiling on each)
| Piece | Provider | Free tier |
|---|---|---|
| Backend + AI engine hosting | Render | 512MB/0.1 CPU, 750 instance-hrs/mo, sleeps after 15 min idle |
| Chat model | Groq | No card; per-model rate limits (generous for personal use) |
| Fallback model | Gemini | No card; free tier on Flash-class models |
| Fallback model | OpenRouter | No card; `:free`-suffixed community models |
| Voice transcription | Groq Whisper | Same key/quota as chat |
| Voice output | Browser `SpeechSynthesis` | Free, local, no account |
| Web search | Tavily | No card; 1,000 searches/month |
| Persistent database (optional) | Neon | No card; scale-to-zero Postgres, no expiry |
| Keep-warm pings (optional) | GitHub Actions | Free minutes on the standard runner |

Every row is a genuine no-credit-card free tier as of this build. Free tiers do
change their terms over time — if one shifts, the provider-abstraction layers
(`ai_provider.py`, `search_provider.py`) mean swapping to an alternative is a
config change, not a rewrite.
