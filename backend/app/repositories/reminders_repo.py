from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Reminder
from app.models.schemas import ReminderCreate, ReminderUpdate


async def list_reminders(session: AsyncSession, *, include_completed: bool = True) -> list[Reminder]:
    stmt = select(Reminder).order_by(Reminder.due_at.is_(None), Reminder.due_at.asc())
    if not include_completed:
        stmt = stmt.where(Reminder.completed.is_(False))
    result = await session.execute(stmt)
    return list(result.scalars().all())


async def get_reminder(session: AsyncSession, reminder_id: str) -> Reminder | None:
    return await session.get(Reminder, reminder_id)


async def create_reminder(session: AsyncSession, payload: ReminderCreate) -> Reminder:
    reminder = Reminder(
        title=payload.title,
        notes=payload.notes,
        due_at=payload.due_at,
        recurrence=payload.recurrence,
    )
    session.add(reminder)
    await session.flush()
    return reminder


async def update_reminder(session: AsyncSession, reminder_id: str, payload: ReminderUpdate) -> Reminder | None:
    reminder = await session.get(Reminder, reminder_id)
    if reminder is None:
        return None
    if payload.title is not None:
        reminder.title = payload.title
    if payload.notes is not None:
        reminder.notes = payload.notes
    if payload.due_at is not None:
        reminder.due_at = payload.due_at
    if payload.recurrence is not None:
        reminder.recurrence = payload.recurrence
    if payload.completed is not None:
        reminder.completed = payload.completed
        reminder.completed_at = datetime.now(timezone.utc) if payload.completed else None
    await session.flush()
    return reminder


async def complete_reminder(session: AsyncSession, reminder_id: str) -> Reminder | None:
    reminder = await session.get(Reminder, reminder_id)
    if reminder is None:
        return None
    reminder.completed = True
    reminder.completed_at = datetime.now(timezone.utc)
    await session.flush()
    return reminder


async def delete_reminder(session: AsyncSession, reminder_id: str) -> bool:
    result = await session.execute(delete(Reminder).where(Reminder.id == reminder_id))
    return result.rowcount > 0
