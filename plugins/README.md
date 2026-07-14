# Chu Chu plugins

Two kinds of "skill" live here, matching how Chu Chu is actually split between
a cloud brain and a local body:

- **`automation-skills/`** — the curated, safe actions the AI can *ask* the
  desktop app to run (open an app, set a reminder, take a screenshot, ...).
  `actions.json` is the canonical, human-readable definition. It's mirrored —
  not shared via import — in `backend/app/services/automation_intents.py`
  (validation) and `frontend/electron/automation/actions.ts` (execution).
  See the comment at the top of `actions.json` for why it's a mirror instead
  of a shared package.

- **`browser-skills/`** — the local-only, opt-in extension point for real
  browser automation (Playwright) beyond the backend's lightweight
  fetch-and-summarize. Not wired into the MVP by default; see its README for
  why and how to enable it.

## Adding a new automation skill
1. Add the definition to `automation-skills/actions.json` (for humans reading
   this repo).
2. Add matching entries to the registry in
   `backend/app/services/automation_intents.py` (a `ActionSpec` + a pydantic
   params model) — this is what actually validates incoming requests.
3. Add matching entries to `frontend/electron/automation/actions.ts` (the
   `ActionExecutors` map) — this is what actually runs on the user's machine.
4. If the action changes something on the user's system, default
   `requires_confirmation` to `true`. Default to `false` only for actions
   that are purely additive/read-only (creating a note, reading system info).

Keep every skill in this file operating on a fixed, named, validated
parameter set — never accept or execute a freeform string as a shell command
or raw coordinate input. That constraint is what keeps a public-URL AI engine
from becoming a remote-control surface for your computer; see
`docs/ARCHITECTURE.md` for the full reasoning.
