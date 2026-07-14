"""
Pydantic schemas — the request/response contracts the frontend codes against.
Kept separate from the ORM models (app/models/orm.py) so the wire format can
evolve independently of the storage format.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, Field


# --- Chat -------------------------------------------------------------------

class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=8000)
    conversation_id: str = Field(default="default", max_length=128)


class ChatHistoryItem(BaseModel):
    id: str
    role: Literal["user", "assistant", "system"]
    content: str
    provider: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


# --- Notes --------------------------------------------------------------------

class NoteCreate(BaseModel):
    title: str = Field(default="Untitled note", max_length=200)
    content: str = Field(default="", max_length=50_000)
    pinned: bool = False
    tags: list[str] = Field(default_factory=list)


class NoteUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    content: str | None = Field(default=None, max_length=50_000)
    pinned: bool | None = None
    tags: list[str] | None = None


class NoteOut(BaseModel):
    id: str
    title: str
    content: str
    pinned: bool
    tags: list[str]
    created_at: datetime
    updated_at: datetime


# --- Reminders ------------------------------------------------------------------

class ReminderCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    notes: str = Field(default="", max_length=2000)
    due_at: datetime | None = None
    recurrence: Literal["none", "daily", "weekly", "monthly"] = "none"


class ReminderUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=200)
    notes: str | None = Field(default=None, max_length=2000)
    due_at: datetime | None = None
    recurrence: Literal["none", "daily", "weekly", "monthly"] | None = None
    completed: bool | None = None


class ReminderOut(BaseModel):
    id: str
    title: str
    notes: str
    due_at: datetime | None
    recurrence: str
    completed: bool
    completed_at: datetime | None
    created_at: datetime


# --- Settings -----------------------------------------------------------------

class SettingsUpdate(BaseModel):
    values: dict[str, Any]


class SettingsOut(BaseModel):
    values: dict[str, Any]


# --- Automation ----------------------------------------------------------------

class AutomationActionSchema(BaseModel):
    """Describes one action Chu Chu is allowed to request the desktop client run."""

    action: str
    description: str
    params: dict[str, str] = Field(default_factory=dict)  # param name -> human description
    requires_confirmation: bool = True


class AutomationActionsOut(BaseModel):
    actions: list[AutomationActionSchema]


# --- Voice ------------------------------------------------------------------------

class TranscribeResponse(BaseModel):
    text: str
    provider: str


# --- Browser / search ------------------------------------------------------------

class SearchResultItem(BaseModel):
    title: str
    url: str
    snippet: str


class SearchResponse(BaseModel):
    query: str
    results: list[SearchResultItem]
    answer: str | None = None
    provider: str


class FetchSummaryRequest(BaseModel):
    url: str = Field(max_length=2000)


class FetchSummaryResponse(BaseModel):
    url: str
    title: str
    summary: str


# --- Health --------------------------------------------------------------------

class HealthOut(BaseModel):
    status: Literal["ok"]
    app: str
    environment: str
    providers_configured: list[str]
