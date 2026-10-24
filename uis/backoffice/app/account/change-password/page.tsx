'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { AuthGuard } from '@/src/components/AuthGuard';
import { fetchWithAuth } from '@/src/utils/api';

type Feedback = { type: 'success' | 'error'; message: string } | null;

const inputClassName =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

function ChangePasswordForm(): ReactElement {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Las contraseñas nuevas no coinciden.' });
      return;
    }
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth('/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_password: currentPassword, new_password: newPassword }),
      });
      if (!response.ok) {
        setFeedback({
          type: 'error',
          message:
            response.status === 400
              ? 'La contraseña actual no es correcta.'
              : response.status === 422
                ? 'La contraseña no es válida (máximo 72 caracteres).'
                : `No se pudo cambiar la contraseña (HTTP ${response.status}).`,
        });
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setFeedback({ type: 'success', message: 'Contraseña actualizada correctamente.' });
    } catch {
      setFeedback({ type: 'error', message: 'No se pudo conectar con la API. Inténtalo de nuevo.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      {feedback && (
        <div
          role={feedback.type === 'error' ? 'alert' : 'status'}
          className={`rounded-lg border px-4 py-3 text-sm ${
            feedback.type === 'success'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {feedback.message}
        </div>
      )}

      <div>
        <label htmlFor="current-password" className="block text-sm font-medium text-slate-700">
          Contraseña actual
        </label>
        <input
          id="current-password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={72}
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="new-password" className="block text-sm font-medium text-slate-700">
          Nueva contraseña
        </label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={72}
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          className={inputClassName}
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="block text-sm font-medium text-slate-700">
          Confirmar contraseña
        </label>
        <input
          id="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          maxLength={72}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          aria-invalid={mismatch}
          aria-describedby={mismatch ? 'confirm-password-error' : undefined}
          className={inputClassName}
        />
        {mismatch && (
          <p id="confirm-password-error" className="mt-1 text-xs text-red-600">
            Las contraseñas no coinciden.
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={isSubmitting || !currentPassword || !newPassword || !confirmPassword || mismatch}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Guardando…' : 'Cambiar contraseña'}
        </button>
      </div>
    </form>
  );
}

/** Cambio de contraseña del usuario autenticado. */
export default function ChangePasswordPage(): ReactElement {
  return (
    <AuthGuard>
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto w-full max-w-2xl">
          <Link href="/account/profile" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
            ← Volver a mi perfil
          </Link>
          <div className="mb-8 mt-4">
            <h1 className="text-2xl font-bold text-slate-900">Cambiar contraseña</h1>
            <p className="mt-1 text-sm text-slate-500">Introduce tu contraseña actual y elige una nueva.</p>
          </div>
          <ChangePasswordForm />
        </div>
      </main>
    </AuthGuard>
  );
}
