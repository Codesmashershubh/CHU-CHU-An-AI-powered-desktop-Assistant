import { useEffect, useState } from "react";
import { Plus, Pin, Trash2, StickyNote, Search } from "lucide-react";
import { useChuChuStore } from "@/lib/store";
import { EmptyState } from "@/components/shared/EmptyState";
import { Button } from "@/components/shared/Button";
import { IconButton } from "@/components/shared/IconButton";
import type { Note } from "@/types";
import styles from "./NotesPanel.module.css";

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function NotesPanel() {
  const notes = useChuChuStore((s) => s.notes);
  const notesLoading = useChuChuStore((s) => s.notesLoading);
  const loadNotes = useChuChuStore((s) => s.loadNotes);
  const createNote = useChuChuStore((s) => s.createNote);
  const updateNote = useChuChuStore((s) => s.updateNote);
  const deleteNote = useChuChuStore((s) => s.deleteNote);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Note | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");

  useEffect(() => {
    loadNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => loadNotes(query || undefined), 250);
    return () => clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  function selectNote(note: Note) {
    setSelected(note);
    setDraftTitle(note.title);
    setDraftContent(note.content);
  }

  function startNewNote() {
    setSelected(null);
    setDraftTitle("");
    setDraftContent("");
  }

  async function handleSave() {
    if (!draftTitle.trim() && !draftContent.trim()) return;
    if (selected) {
      await updateNote(selected.id, { title: draftTitle || "Untitled note", content: draftContent });
    } else {
      await createNote(draftTitle || "Untitled note", draftContent);
      startNewNote();
    }
  }

  return (
    <div className={styles.panel}>
      <aside className={styles.list}>
        <div className={styles.listHeader}>
          <div className={styles.searchBox}>
            <Search size={13} />
            <input
              placeholder="Search notes…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <IconButton aria-label="New note" onClick={startNewNote}>
            <Plus size={16} />
          </IconButton>
        </div>

        <div className={styles.listScroll}>
          {notesLoading && notes.length === 0 ? (
            <p className={styles.loading}>Loading…</p>
          ) : notes.length === 0 ? (
            <EmptyState icon={<StickyNote size={22} />} title="No notes yet" description="Create one, or ask Chu Chu to jot something down for you." />
          ) : (
            notes.map((note) => (
              <button
                key={note.id}
                className={`${styles.listItem} ${selected?.id === note.id ? styles.listItemActive : ""}`}
                onClick={() => selectNote(note)}
              >
                <div className={styles.listItemTop}>
                  {note.pinned && <Pin size={11} className={styles.pinIcon} />}
                  <span className={styles.listItemTitle}>{note.title || "Untitled note"}</span>
                </div>
                <p className={styles.listItemPreview}>{note.content || "Empty note"}</p>
                <span className={styles.listItemDate}>{formatDate(note.updated_at)}</span>
              </button>
            ))
          )}
        </div>
      </aside>

      <section className={styles.editor}>
        <div className={styles.editorToolbar}>
          <input
            className={styles.titleInput}
            placeholder="Note title"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            onBlur={handleSave}
          />
          <div className={styles.editorActions}>
            {selected && (
              <>
                <IconButton
                  aria-label={selected.pinned ? "Unpin note" : "Pin note"}
                  active={selected.pinned}
                  onClick={() => updateNote(selected.id, { pinned: !selected.pinned }).then(() => selectNote({ ...selected, pinned: !selected.pinned }))}
                >
                  <Pin size={15} />
                </IconButton>
                <IconButton
                  aria-label="Delete note"
                  onClick={async () => {
                    await deleteNote(selected.id);
                    startNewNote();
                  }}
                >
                  <Trash2 size={15} />
                </IconButton>
              </>
            )}
          </div>
        </div>
        <textarea
          className={styles.contentArea}
          placeholder="Write something…"
          value={draftContent}
          onChange={(e) => setDraftContent(e.target.value)}
          onBlur={handleSave}
        />
        {!selected && (draftTitle || draftContent) && (
          <div className={styles.saveBar}>
            <Button variant="primary" size="sm" onClick={handleSave}>
              Save note
            </Button>
          </div>
        )}
      </section>
    </div>
  );
}
