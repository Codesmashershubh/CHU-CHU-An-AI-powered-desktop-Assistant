"""
The automation allowlist.

This is the single most important safety boundary in Chu Chu. The AI engine
runs on a public Render URL and takes free-text input — it must never be able
to directly execute anything. Instead:

  1. The model may emit a fenced ```chu-action block describing an intended
     action (see services/streaming.py for how that's parsed out of the
     stream).
  2. This module validates that block against a fixed allowlist and a strict
     parameter schema. Anything that doesn't match is dropped, not executed.
  3. The validated action is sent to the Electron client as a structured SSE
     event. The client — running locally, on the user's own machine — is the
     only thing that ever actually calls pyautogui-equivalent APIs, and it
     shows a confirmation dialog first for anything that isn't purely
     read-only.

The backend NEVER executes actions itself. There is deliberately no code path
from "text arrived over the internet" to "something happened on a computer"
that skips a human clicking "confirm" on their own machine. Keep it that way
if you extend this list.
"""
from __future__ import annotations

from pydantic import BaseModel, ValidationError


class ActionSpec(BaseModel):
    name: str
    description: str
    params: dict[str, str]  # param name -> human-readable description, for the prompt
    requires_confirmation: bool
    confirm_template: str  # "{param}" placeholders filled in from parsed params


class ParsedAction(BaseModel):
    action: str
    params: dict[str, str] = {}


# --- Per-action parameter schemas -------------------------------------------------

class OpenAppParams(BaseModel):
    name: str


class OpenUrlParams(BaseModel):
    url: str


class CreateNoteParams(BaseModel):
    title: str
    content: str = ""


class SetReminderParams(BaseModel):
    title: str
    due_at: str  # ISO-8601, validated loosely here — the client re-parses it


class SearchWebParams(BaseModel):
    query: str


class CopyToClipboardParams(BaseModel):
    text: str


class NoParams(BaseModel):
    pass


# --- The allowlist -----------------------------------------------------------------
# name -> (ActionSpec metadata, pydantic model used to validate `params`)

_REGISTRY: dict[str, tuple[ActionSpec, type[BaseModel]]] = {
    "open_app": (
        ActionSpec(
            name="open_app",
            description="Launch an application already installed on the user's computer.",
            params={"name": "application name, e.g. 'notepad', 'calculator', 'terminal'"},
            requires_confirmation=True,
            confirm_template="Open {name}?",
        ),
        OpenAppParams,
    ),
    "open_url": (
        ActionSpec(
            name="open_url",
            description="Open a URL in the user's default web browser.",
            params={"url": "a full URL, e.g. 'https://example.com'"},
            requires_confirmation=True,
            confirm_template="Open {url} in your browser?",
        ),
        OpenUrlParams,
    ),
    "create_note": (
        ActionSpec(
            name="create_note",
            description="Save a note into Chu Chu's Notes panel.",
            params={"title": "short title", "content": "the note body"},
            requires_confirmation=False,
            confirm_template="Save note '{title}'?",
        ),
        CreateNoteParams,
    ),
    "set_reminder": (
        ActionSpec(
            name="set_reminder",
            description="Create a reminder in Chu Chu's Reminders panel.",
            params={"title": "what to be reminded of", "due_at": "ISO-8601 datetime"},
            requires_confirmation=False,
            confirm_template="Remind you to '{title}'?",
        ),
        SetReminderParams,
    ),
    "search_web": (
        ActionSpec(
            name="search_web",
            description="Run a web search and summarize the results.",
            params={"query": "search query"},
            requires_confirmation=False,
            confirm_template="Search the web for '{query}'?",
        ),
        SearchWebParams,
    ),
    "take_screenshot": (
        ActionSpec(
            name="take_screenshot",
            description="Capture the user's screen and save it to their Chu Chu workspace folder.",
            params={},
            requires_confirmation=True,
            confirm_template="Take a screenshot?",
        ),
        NoParams,
    ),
    "get_system_info": (
        ActionSpec(
            name="get_system_info",
            description="Read basic, non-sensitive system info (OS, battery, memory headroom).",
            params={},
            requires_confirmation=False,
            confirm_template="Check system info?",
        ),
        NoParams,
    ),
    "copy_to_clipboard": (
        ActionSpec(
            name="copy_to_clipboard",
            description="Copy text to the user's clipboard.",
            params={"text": "text to copy"},
            requires_confirmation=True,
            confirm_template="Copy this to your clipboard?",
        ),
        CopyToClipboardParams,
    ),
    "open_workspace": (
        ActionSpec(
            name="open_workspace",
            description="Open Chu Chu's local workspace folder (notes, screenshots) in the file explorer.",
            params={},
            requires_confirmation=False,
            confirm_template="Open your Chu Chu workspace folder?",
        ),
        NoParams,
    ),
}


def list_action_specs() -> list[ActionSpec]:
    return [spec for spec, _ in _REGISTRY.values()]


def build_actions_prompt_fragment() -> str:
    """Rendered into the system prompt so the model knows exactly what it may request,
    in exactly what shape — and nothing else."""
    lines = [
        "You can ask the desktop app to perform a small set of safe actions. To do so, "
        "after your normal reply, add a single fenced block in EXACTLY this form:",
        "",
        "```chu-action",
        '{"action": "<action_name>", "params": {...}}',
        "```",
        "",
        "Only use an action when the user's message actually asks for one — never attach "
        "one to an ordinary conversational reply. Only ever emit ONE action block per reply. "
        "The available actions are:",
    ]
    for spec in list_action_specs():
        param_desc = ", ".join(f"{k} ({v})" for k, v in spec.params.items()) or "no params"
        lines.append(f"- {spec.name}: {spec.description} Params: {param_desc}.")
    lines.append(
        "\nIf nothing the user asked for maps to one of these, do not emit an action block at all."
    )
    return "\n".join(lines)


class ValidatedAction(BaseModel):
    action: str
    params: dict[str, str]
    confirm_text: str
    requires_confirmation: bool


def validate_action(raw: dict) -> ValidatedAction | None:
    """Returns a ValidatedAction if `raw` matches a known action with well-formed
    params, otherwise None. Never raises — malformed/unknown actions are just dropped."""
    try:
        parsed = ParsedAction.model_validate(raw)
    except ValidationError:
        return None

    entry = _REGISTRY.get(parsed.action)
    if entry is None:
        return None
    spec, param_model = entry

    try:
        validated_params = param_model.model_validate(parsed.params)
    except ValidationError:
        return None

    params_dict = validated_params.model_dump()
    try:
        confirm_text = spec.confirm_template.format(**params_dict)
    except (KeyError, IndexError):
        confirm_text = spec.description

    return ValidatedAction(
        action=spec.name,
        params={k: str(v) for k, v in params_dict.items()},
        confirm_text=confirm_text,
        requires_confirmation=spec.requires_confirmation,
    )
