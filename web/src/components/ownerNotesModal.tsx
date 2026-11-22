import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Modal from "./Modal";
import ConfirmDialog from "./ConfirmDialog";
import { createNote, deleteNote, fetchNotes, updateNote } from "../api/ownerExtras";
import type { OwnerNote } from "../api/ownerExtras";

type Tenant = { id: string; name: string };

export default function OwnerNotesModal({
  token,
  tenant,
  onClose,
}: {
  token: string;
  tenant: Tenant | null;
  onClose: () => void;
}) {
  return (
    <Modal open={!!tenant} title={tenant ? `Notes for ${tenant.name}` : "Notes"} onClose={onClose}>
      {tenant && <NotesBody token={token} tenant={tenant} />}
    </Modal>
  );
}

function NotesBody({ token, tenant }: { token: string; tenant: Tenant }) {
  const queryClient = useQueryClient();
  const [newBody, setNewBody] = useState("");
  const [editing, setEditing] = useState<{ id: string; body: string } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<OwnerNote | null>(null);

  const notes = useQuery({
    queryKey: ["owner-notes", token, tenant.id],
    queryFn: () => fetchNotes(token, tenant.id),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["owner-notes"] });

  const add = useMutation({
    mutationFn: () => createNote(token, tenant.id, newBody.trim()),
    onSuccess: () => {
      setNewBody("");
      refresh();
    },
  });

  const save = useMutation({
    mutationFn: (n: { id: string; body: string }) => updateNote(token, n.id, { body: n.body.trim() }),
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
  });

  const toggle = useMutation({
    mutationFn: (n: OwnerNote) => updateNote(token, n.id, { isDone: !n.isDone }),
    onSuccess: refresh,
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteNote(token, id),
    onSuccess: () => {
      setPendingDelete(null);
      refresh();
    },
  });

  const error = [add, save, toggle, remove].find((m) => m.isError)?.error as Error | undefined;

  return (
    <div className="notes-body">
      <form
        className="note-form"
        onSubmit={(e) => {
          e.preventDefault();
          if (newBody.trim()) add.mutate();
        }}
      >
        <textarea
          rows={3}
          maxLength={1000}
          placeholder="Add a note, such as 'prefers 2 PM viewings'"
          value={newBody}
          onChange={(e) => setNewBody(e.target.value)}
        />
        <button type="submit" className="btn-search" disabled={add.isPending || !newBody.trim()}>
          {add.isPending ? "Adding…" : "Add note"}
        </button>
      </form>

      {error && <p className="error">{error.message}</p>}
      {notes.isLoading && <p>Loading notes…</p>}
      {notes.data?.length === 0 && <p className="muted">No notes yet for this tenant.</p>}

      <ul className="note-list">
        {notes.data?.map((n) => (
          <li key={n.id} className={`note-item${n.isDone ? " done" : ""}`}>
            {editing?.id === n.id ? (
              <form
                className="note-edit"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editing.body.trim()) save.mutate(editing);
                }}
              >
                <textarea
                  rows={2}
                  maxLength={1000}
                  value={editing.body}
                  onChange={(e) => setEditing({ id: n.id, body: e.target.value })}
                />
                <div className="card-actions">
                  <button type="submit" className="btn-search" disabled={save.isPending}>
                    Save
                  </button>
                  <button type="button" className="btn-clear" onClick={() => setEditing(null)}>
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <>
                <label className="note-check">
                  <input type="checkbox" checked={n.isDone} onChange={() => toggle.mutate(n)} />
                  <span>{n.body}</span>
                </label>
                <div className="note-meta">
                  <span className="muted">{new Date(n.updatedAt).toLocaleDateString("en-PH", { dateStyle: "medium" })}</span>
                  <button type="button" className="link-btn" onClick={() => setEditing({ id: n.id, body: n.body })}>
                    Edit
                  </button>
                  <button type="button" className="link-btn danger" onClick={() => setPendingDelete(n)}>
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this note?"
        message="The note will be removed. Your tenant's account isn't affected."
        confirmLabel="Delete"
        cancelLabel="Keep"
        tone="danger"
        onConfirm={() => pendingDelete && remove.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}