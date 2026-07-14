"""
ORM models. Mirrors the PRD's Database_Design.md table list exactly:
users (optional), notes, reminders, history, settings.

Chu Chu is single-user by design (it's a personal desktop assistant, not a
multi-tenant product), so `user_id` columns are nullable and default to the
single local profile. The column exists so multi-profile support (Future
Enhancements: "multi-agent") doesn't require a schema migration later.
"""
from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


class User(Base):
    """Optional — present so the schema can grow into multi-profile support."""

    __tablename__ = "users"

    id: Mapped[str] = mapped_column(primary_key=True, default=_uuid)
    display_name: Mapped[str] = mapped_column(Text, default="You")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Note(Base):
    __tablename__ = "notes"

    id: Mapped[str] = mapped_column(primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(Text, default="Untitled note")
    content: Mapped[str] = mapped_column(Text, default="")
    pinned: Mapped[bool] = mapped_column(Boolean, default=False)
    tags: Mapped[str] = mapped_column(Text, default="")  # comma-separated, kept simple on purpose
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Reminder(Base):
    __tablename__ = "reminders"

    id: Mapped[str] = mapped_column(primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    title: Mapped[str] = mapped_column(Text)
    notes: Mapped[str] = mapped_column(Text, default="")
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    recurrence: Mapped[str] = mapped_column(Text, default="none")  # none|daily|weekly|monthly
    completed: Mapped[bool] = mapped_column(Boolean, default=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class HistoryMessage(Base):
    """One row per chat turn — powers the transcript and short-term memory."""

    __tablename__ = "history"

    id: Mapped[str] = mapped_column(primary_key=True, default=_uuid)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    conversation_id: Mapped[str] = mapped_column(Text, index=True)
    role: Mapped[str] = mapped_column(Text)  # "user" | "assistant" | "system"
    content: Mapped[str] = mapped_column(Text)
    provider: Mapped[str | None] = mapped_column(Text, nullable=True)  # which AI engine answered
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Setting(Base):
    """Plain key/value store for app + persona preferences."""

    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(primary_key=True)
    value: Mapped[str] = mapped_column(Text, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )
