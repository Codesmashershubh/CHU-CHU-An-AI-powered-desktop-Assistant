from __future__ import annotations

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.orm import Note
from app.models.schemas import NoteCreate, NoteUpdate


def _tags_to_str(tags: list[str]) -> str:
    return ",".join(t.strip() for t in tags if t.strip())


def _tags_to_list(tags: str) -> list[str]:
    return [t for t in tags.split(",") if t]


async def list_notes(session: AsyncSession, *, query: str | None = None) -> list[Note]:
    stmt = select(Note).order_by(Note.pinned.desc(), Note.updated_at.desc())
    result = await session.execute(stmt)
    notes = list(result.scalars().all())
    if query:
        q = query.lower()
        notes = [n for n in notes if q in n.title.lower() or q in n.content.lower()]
    return notes


async def get_note(session: AsyncSession, note_id: str) -> Note | None:
    return await session.get(Note, note_id)


async def create_note(session: AsyncSession, payload: NoteCreate) -> Note:
    note = Note(
        title=payload.title or "Untitled note",
        content=payload.content,
        pinned=payload.pinned,
        tags=_tags_to_str(payload.tags),
    )
    session.add(note)
    await session.flush()
    return note


async def update_note(session: AsyncSession, note_id: str, payload: NoteUpdate) -> Note | None:
    note = await session.get(Note, note_id)
    if note is None:
        return None
    if payload.title is not None:
        note.title = payload.title
    if payload.content is not None:
        note.content = payload.content
    if payload.pinned is not None:
        note.pinned = payload.pinned
    if payload.tags is not None:
        note.tags = _tags_to_str(payload.tags)
    await session.flush()
    return note


async def delete_note(session: AsyncSession, note_id: str) -> bool:
    result = await session.execute(delete(Note).where(Note.id == note_id))
    return result.rowcount > 0


def note_tags(note: Note) -> list[str]:
    return _tags_to_list(note.tags)
