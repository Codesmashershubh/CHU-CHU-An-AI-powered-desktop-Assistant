from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_shared_secret
from app.models.schemas import ReminderCreate, ReminderOut, ReminderUpdate
from app.repositories import reminders_repo

router = APIRouter(
    prefix="/api/reminders", tags=["reminders"], dependencies=[Depends(require_shared_secret)]
)


def _to_out(r) -> ReminderOut:
    return ReminderOut(
        id=r.id,
        title=r.title,
        notes=r.notes,
        due_at=r.due_at,
        recurrence=r.recurrence,
        completed=r.completed,
        completed_at=r.completed_at,
        created_at=r.created_at,
    )


@router.get("", response_model=list[ReminderOut])
async def list_reminders(
    include_completed: bool = True, session: AsyncSession = Depends(get_session)
) -> list[ReminderOut]:
    reminders = await reminders_repo.list_reminders(session, include_completed=include_completed)
    return [_to_out(r) for r in reminders]


@router.post("", response_model=ReminderOut, status_code=status.HTTP_201_CREATED)
async def create_reminder(
    payload: ReminderCreate, session: AsyncSession = Depends(get_session)
) -> ReminderOut:
    reminder = await reminders_repo.create_reminder(session, payload)
    return _to_out(reminder)


@router.put("/{reminder_id}", response_model=ReminderOut)
async def update_reminder(
    reminder_id: str, payload: ReminderUpdate, session: AsyncSession = Depends(get_session)
) -> ReminderOut:
    reminder = await reminders_repo.update_reminder(session, reminder_id, payload)
    if reminder is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_out(reminder)


@router.post("/{reminder_id}/complete", response_model=ReminderOut)
async def complete_reminder(reminder_id: str, session: AsyncSession = Depends(get_session)) -> ReminderOut:
    reminder = await reminders_repo.complete_reminder(session, reminder_id)
    if reminder is None:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return _to_out(reminder)


@router.delete("/{reminder_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_reminder(reminder_id: str, session: AsyncSession = Depends(get_session)) -> None:
    deleted = await reminders_repo.delete_reminder(session, reminder_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Reminder not found")
