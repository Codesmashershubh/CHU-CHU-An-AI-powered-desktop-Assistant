# Chu Chu frontend

Electron + React + TypeScript + Vite. See
[../docs/DESIGN.md](../docs/DESIGN.md) for the visual identity and
[../docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) for why voice/automation
work the way they do here.

## Local development

```bash
npm install
cp .env.example .env    # point VITE_API_BASE_URL at your backend
npm run electron:dev    # Vite dev server + Electron together
```

Prefer a plain browser tab while iterating on UI? `npm run dev` alone works
too — anything that needs the Electron bridge (`window.chuchu`, i.e. window
controls and OS automation) degrades gracefully rather than crashing when
that bridge isn't present.

## Building an installer

```bash
npm run electron:build
```

Output lands in `frontend/release/`, for whichever OS you ran the command
on — electron-builder doesn't reliably cross-compile, so build on each
target platform (or wire up a GitHub Actions matrix if you want all three
from one push; not included by default).

### App icon
`build/icon.png` and `build/icon.ico` are already generated (the twin-pulse
mark — see `docs/DESIGN.md`). macOS `.icns` isn't included since generating
one needs either a Mac (`iconutil`) or an online converter — feed either
one `build/icon.png` (1024×1024) and drop the result at `build/icon.icns`.
electron-builder falls back to the PNG if it's missing, so this only
matters if you want a proper Mac icon in Finder/the Dock.

## Project layout

```
electron/
├── main.js                 Main process: window, tray, global shortcut, IPC
├── preload.js                contextBridge — the only thing the renderer can reach
├── preload.d.ts                TS types for window.chuchu
└── automation/actions.js         The actual OS calls (spawn, clipboard, screenshot, ...)
src/
├── App.tsx                  Shell: titlebar + sidebar + active panel + command palette
├── components/                One folder per panel/widget, colocated .module.css
├── lib/
│   ├── api.ts                  Backend client, incl. hand-rolled SSE parsing for chat
│   ├── store.ts                  Zustand — all app state and the actions that mutate it
│   └── automationRunner.ts         Dispatches a validated action to Electron or the REST API
├── hooks/                     useVoice (MediaRecorder + Whisper), useGlobalHotkeys (⌘K)
└── styles/                    tokens.css (design tokens) + globals.css (base styles)
```

## Why plain JS for `electron/`, not TypeScript
The main process runs directly in Node with no build step. Keeping it plain
CommonJS means there's nothing to compile and nothing that can go stale
between a `.ts` source file and a build artifact — `electron/main.js` you
read is exactly what runs. The renderer (`src/`) is the part that benefits
from React + TS + Vite's tooling, and that's where it's used.
