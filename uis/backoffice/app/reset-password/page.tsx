'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { API_BASE_URL } from '@/src/utils/api';

type Feedback = { type: 'success' | 'error'; message: string } | null;

const REDIRECT_DELAY_MS = 2500;

const inputClassName =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

function ResetPasswordForm(): ReactElement {
  const router = useRouter();
  const token = useSearchParams().get('token') ?? '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [feedback, setFeedback] = useState<Feedback>(
    token ? null : { type: 'error', message: 'El enlace no es válido: falta el token de recuperación.' },
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSuccess = feedback?.type === 'success';
  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  useEffect(() => {
    if (!isSuccess) return;
    const timer = window.setTimeout(() => router.replace('/login'), REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [isSuccess, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setFeedback({ type: 'error', message: 'Las contraseñas no coinciden.' });
      return;
    }
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, new_password: newPassword }),
      });
      if (!response.ok) {
        setFeedback({
          type: 'error',
          message:
            response.status === 400
              ? 'El enlace no es válido o ha caducado.'
              : `No se pudo restablecer la contraseña (HTTP ${response.status}).`,
        });
        return;
      }
      setFeedback({ type: 'success', message: 'Contraseña restablecida. Redirigiendo al inicio de sesión…' });
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
            isSuccess ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          <p>{feedback.message}</p>
          {!isSuccess && (
            <Link href="/forgot-password" className="mt-2 inline-block font-medium underline hover:text-red-800">
              Solicitar un nuevo enlace
            </Link>
          )}
        </div>
      )}

      <fieldset disabled={!token || isSubmitting || isSuccess} className="space-y-5">
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
            Confirmar nueva contraseña
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

        <button
          type="submit"
          disabled={!newPassword || !confirmPassword || mismatch}
          className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Guardando…' : 'Restablecer contraseña'}
        </button>
      </fieldset>
    </form>
  );
}

/** Restablecimiento de contraseña a partir del enlace recibido por email. */
export default function ResetPasswordPage(): ReactElement {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">TrackFlow Control</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Nueva contraseña</h1>
          <p className="mt-1 text-sm text-slate-500">Elige una contraseña nueva para tu cuenta.</p>
        </div>
        {/* useSearchParams requires a Suspense boundary for static prerendering. */}
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </main>
  );
}
