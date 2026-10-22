'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { API_BASE_URL } from '@/src/utils/api';

const inputClassName =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500';

/** Solicitud del enlace de recuperación de contraseña. */
export default function ForgotPasswordPage(): ReactElement {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch(`${API_BASE_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
    } catch {
      // The outcome is intentionally hidden to avoid revealing which emails exist.
    } finally {
      setIsSubmitting(false);
      setIsSent(true);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">TrackFlow Control</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Recupera tu contraseña</h1>
          <p className="mt-1 text-sm text-slate-500">Te enviaremos un enlace para restablecerla.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          {isSent && (
            <div role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              Si esa dirección está registrada, recibirás un enlace en breve
            </div>
          )}

          <fieldset disabled={isSent || isSubmitting} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClassName}
                placeholder="tu@empresa.com"
              />
            </div>

            <button
              type="submit"
              disabled={!email.trim()}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
            </button>
          </fieldset>

          <p className="text-center text-sm text-slate-500">
            <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
              Volver a iniciar sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
