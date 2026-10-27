'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { useAuth } from '@/src/contexts/AuthContext';

const inputClassName =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

/** Formulario de inicio de sesión del backoffice. */
export default function LoginPage(): ReactElement {
  const { login } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');
    setIsSubmitting(true);
    try {
      await login(email, password);
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'No se pudo conectar con la API. Comprueba que el servidor está en marcha.'
          : err instanceof Error
            ? err.message
            : 'No se pudo iniciar sesión.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">TrackFlow Control</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Inicia sesión</h1>
          <p className="mt-1 text-sm text-slate-500">Accede al centro de control operativo.</p>
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="space-y-5 rounded-2xl border border-slate-200 bg-white p-8 shadow-sm"
        >
          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              <p className="font-medium">{error}</p>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
                <Link href="/forgot-password" className="font-semibold text-red-800 underline hover:text-red-950">
                  Recuperar contraseña
                </Link>
                <span className="text-red-600">
                  ¿Problemas para acceder? Contacta a soporte@trackflow.com
                </span>
              </div>
            </div>
          )}

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

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClassName}
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !email || !password}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Entrando…' : 'Entrar'}
          </button>

          <p className="text-center text-sm">
            <Link href="/forgot-password" className="text-slate-500 hover:text-emerald-700 hover:underline">
              ¿Olvidaste tu contraseña?
            </Link>
          </p>

          <p className="text-center text-sm text-slate-500">
            ¿No tienes cuenta?{' '}
            <Link href="/register" className="font-medium text-emerald-600 hover:text-emerald-700">
              Regístrate
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
