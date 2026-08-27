'use client';

import { FormEvent, useEffect, useState } from 'react';

import { addNote, deleteNote, getNotes } from '@/src/services/api';
import { CandidateNote } from '@/src/types/candidate';

type NotesSectionProps = {
  candidateId: string;
};

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function NotesSection({ candidateId }: NotesSectionProps) {
  const [notes, setNotes] = useState<CandidateNote[]>([]);
  const [newNoteContent, setNewNoteContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isAdding, setIsAdding] = useState<boolean>(false);
  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const loadNotes = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const data = await getNotes(candidateId);
      setNotes(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudieron cargar las notas.';
      setErrorMessage(message);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotes();
  }, [candidateId]);

  const handleAddNote = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const content = newNoteContent.trim();
    if (!content) {
      setErrorMessage('La nota no puede estar vacía.');
      return;
    }

    setIsAdding(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const created = await addNote(candidateId, { content });
      setNotes((previous) => [created, ...previous]);
      setNewNoteContent('');
      setSuccessMessage('Nota agregada correctamente.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo agregar la nota.';
      setErrorMessage(message);
    } finally {
      setIsAdding(false);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    const confirmed = window.confirm('¿Eliminar esta nota?');
    if (!confirmed) {
      return;
    }

    setDeletingNoteId(noteId);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await deleteNote(candidateId, noteId);
      setNotes((previous) => previous.filter((note) => note.id !== noteId));
      setSuccessMessage('Nota eliminada correctamente.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo eliminar la nota.';
      setErrorMessage(message);
    } finally {
      setDeletingNoteId(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Notas</h3>

      <form onSubmit={handleAddNote} className="mt-4 space-y-3">
        <textarea
          value={newNoteContent}
          onChange={(event) => setNewNoteContent(event.target.value)}
          placeholder="Agregar observaciones de entrevistas, validaciones o próximos pasos..."
          rows={4}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isAdding}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isAdding ? 'Agregando...' : 'Agregar Nota'}
          </button>
        </div>
      </form>

      {errorMessage ? (
        <div className="mt-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {successMessage ? (
        <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      {isLoading ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">Cargando notas...</div>
      ) : null}

      {!isLoading && notes.length === 0 ? (
        <div className="mt-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-4 text-sm text-slate-600">
          Aún no hay notas registradas.
        </div>
      ) : null}

      {!isLoading && notes.length > 0 ? (
        <ul className="mt-4 space-y-3">
          {notes.map((note) => (
            <li key={note.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-slate-800">{note.content}</p>
                <button
                  type="button"
                  onClick={() => {
                    void handleDeleteNote(note.id);
                  }}
                  disabled={deletingNoteId === note.id}
                  className="shrink-0 rounded-md border border-rose-300 px-2 py-1 text-xs font-semibold text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  aria-label="Eliminar nota"
                >
                  {deletingNoteId === note.id ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">{formatDate(note.created_at)}</p>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
