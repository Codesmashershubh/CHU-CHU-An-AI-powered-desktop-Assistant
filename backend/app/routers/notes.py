from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.security import require_shared_secret
from app.models.schemas import NoteCreate, NoteOut, NoteUpdate
from app.repositories import notes_repo

router = APIRouter(prefix="/api/notes", tags=["notes"], dependencies=[Depends(require_shared_secret)])


def _to_out(note) -> NoteOut:
    return NoteOut(
        id=note.id,
        title=note.title,
        content=note.content,
        pinned=note.pinned,
        tags=notes_repo.note_tags(note),
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.get("", response_model=list[NoteOut])
async def list_notes(q: str | None = None, session: AsyncSession = Depends(get_session)) -> list[NoteOut]:
    notes = await notes_repo.list_notes(session, query=q)
    return [_to_out(n) for n in notes]


@router.post("", response_model=NoteOut, status_code=status.HTTP_201_CREATED)
async def create_note(payload: NoteCreate, session: AsyncSession = Depends(get_session)) -> NoteOut:
    note = await notes_repo.create_note(session, payload)
    return _to_out(note)


@router.get("/{note_id}", response_model=NoteOut)
async def get_note(note_id: str, session: AsyncSession = Depends(get_session)) -> NoteOut:
    note = await notes_repo.get_note(session, note_id)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return _to_out(note)


@router.put("/{note_id}", response_model=NoteOut)
async def update_note(
    note_id: str, payload: NoteUpdate, session: AsyncSession = Depends(get_session)
) -> NoteOut:
    note = await notes_repo.update_note(session, note_id, payload)
    if note is None:
        raise HTTPException(status_code=404, detail="Note not found")
    return _to_out(note)


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
async def delete_note(note_id: str, session: AsyncSession = Depends(get_session)) -> None:
    deleted = await notes_repo.delete_note(session, note_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Note not found")
