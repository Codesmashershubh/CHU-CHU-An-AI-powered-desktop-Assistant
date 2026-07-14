# Browser skills (local-only, opt-in)

The backend's `/api/browser/*` endpoints intentionally do *not* run a real
browser — see "Browser automation" in `docs/ARCHITECTURE.md` for why a
headless Chromium doesn't fit Render's free tier. What they give you instead
is enough for "search the web" and "summarize this page."

If you want real browser automation — filling forms, clicking through a
logged-in session, scraping something dynamic — that's a **local** capability
by design (it should run as you, in your own browser context, not from a
public cloud service), and this folder is where it plugs in.

## Enabling it
1. `cd frontend && npx playwright install chromium` (one-time, downloads a
   local browser binary — this runs on your machine, never on Render).
2. Implement the action in `frontend/electron/automation/browserSkills.js`
   (a starting stub is there) using the `playwright` npm package, already
   listed as an optional dependency in `frontend/package.json`.
3. Register it the same way as any other skill — see `plugins/README.md`.
4. Because this executes real page interactions, treat it like any other
   system-modifying action: `requires_confirmation: true`, and describe in
   the confirmation dialog *exactly* what page/action is about to run.

## Why this isn't on by default
Playwright's browser binaries are a large local dependency
(chromium ~300MB) that most people trying Chu Chu for the first time don't
need, and shipping a plugin that clicks around a browser on your behalf is
worth an explicit opt-in rather than a default. The scaffold is here — Phase
3 of the roadmap — but turning it on is a deliberate step, not an install-time
default.
