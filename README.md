# Chu Chu

A free, 8GB-laptop-optimized AI OS assistant. Dark, fast, and built to run
entirely on no-credit-card free tiers — backend and AI engine on Render,
desktop shell on your own machine.

<p>
  <img src="frontend/build/icon.png" width="72" alt="Chu Chu" />
</p>

## What it is

- A desktop app (Electron + React) that sits in your tray with a global
  shortcut (`Ctrl/Cmd+Shift+Space`), a command palette (`Ctrl/Cmd+K`), chat,
  notes, and reminders.
- A backend (FastAPI) that runs on Render's free tier and talks to free
  hosted AI APIs (Groq, with Gemini/OpenRouter as fallback) instead of
  running a model in-process — which is also *why* it fits in 512MB of RAM.
- A small, safety-conscious automation layer: the AI can *ask* to open an
  app, set a reminder, take a screenshot, etc.; only the desktop app,
  running locally, ever actually does it, and only after you confirm.

Full reasoning behind every one of those choices — especially where they
depart from the original tech-stack brief (Ollama, pyautogui, local
Whisper) and why — is in **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**.

## Quickstart

```
chu-chu/
├── backend/     FastAPI + AI engine → deploys to Render (free)
├── frontend/    Electron + React desktop app → runs on your machine
├── plugins/     Automation skill definitions (see plugins/README.md)
└── docs/        Architecture, deployment, design, roadmap notes
```

1. **Deploy the backend** — [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) walks
   through it end to end; roughly: click Render's Blueprint deploy, paste in
   a free Groq API key, done.
2. **Run the desktop app**:
   ```bash
   cd frontend
   cp .env.example .env   # point it at your Render URL + shared secret
   npm install
   npm run electron:dev
   ```
3. Talk to it. `Ctrl/Cmd+K` for the command palette, the mic icon for voice.

## Docs

| | |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Every non-obvious decision, and why — start here |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | Step-by-step Render + local setup |
| [docs/DESIGN.md](docs/DESIGN.md) | The visual identity and why it looks the way it does |
| [docs/ROADMAP_NOTES.md](docs/ROADMAP_NOTES.md) | The PRD's 5 phases, mapped to what's actually built |
| [plugins/README.md](plugins/README.md) | How the automation skill system works, and how to extend it |
| [backend/README.md](backend/README.md) | Backend-specific dev notes |
| [frontend/README.md](frontend/README.md) | Frontend-specific dev notes |

## What's genuinely free here

Render (backend hosting), Groq (chat + voice transcription), Gemini and
OpenRouter (fallback models), Tavily (web search), and the browser's own
`SpeechSynthesis` (voice output) — every one of those is a real,
no-credit-card free tier as of this build, cross-checked against each
provider's current docs rather than assumed from memory. See the cost
ledger at the bottom of `docs/ARCHITECTURE.md` for specifics and ceilings.

## License

MIT — see [LICENSE](LICENSE).
