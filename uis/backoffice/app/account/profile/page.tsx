'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ChangeEvent, FormEvent, ReactElement } from 'react';

import { AuthGuard } from '@/src/components/AuthGuard';
import type { AuthUser } from '@/src/contexts/AuthContext';
import { useAuth } from '@/src/contexts/AuthContext';
import { fetchWithAuth } from '@/src/utils/api';

type ProfileField = 'name' | 'phone' | 'address';

type ProfileValues = Record<ProfileField, string>;

type Feedback = { type: 'success' | 'error'; message: string } | null;

const FIELDS: { name: ProfileField; label: string; type: string; autoComplete: string }[] = [
  { name: 'name', label: 'Nombre', type: 'text', autoComplete: 'name' },
  { name: 'phone', label: 'Teléfono', type: 'tel', autoComplete: 'tel' },
  { name: 'address', label: 'Dirección', type: 'text', autoComplete: 'street-address' },
];

const inputClassName =
  'mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20';

/** Formulario de edición; solo se monta con un usuario autenticado. */
function ProfileForm({ user }: { user: AuthUser }): ReactElement {
  const { refreshUser, logout } = useAuth();
  const [values, setValues] = useState<ProfileValues>({
    name: user.name,
    phone: user.phone,
    address: user.address,
  });
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const name = event.target.name as ProfileField;
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setFeedback(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setFeedback(null);
    setIsSubmitting(true);
    try {
      const response = await fetchWithAuth('/profiles/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: values.name.trim(),
          phone: values.phone.trim(),
          address: values.address.trim(),
        }),
      });
      if (!response.ok) {
        setFeedback({
          type: 'error',
          message:
            response.status === 422
              ? 'Algunos datos no son válidos. Revisa el formulario.'
              : `No se pudo guardar el perfil (HTTP ${response.status}).`,
        });
        return;
      }
      await refreshUser();
      setFeedback({ type: 'success', message: 'Perfil actualizado correctamente.' });
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
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={user.email}
          disabled
          readOnly
          className="mt-1 block w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2 text-sm text-slate-500"
        />
        <p className="mt-1 text-xs text-slate-400">
          Rol: <span className="font-medium text-slate-600">{user.role}</span>
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {FIELDS.map((field) => (
          <div key={field.name} className={field.name === 'address' ? 'sm:col-span-2' : undefined}>
            <label htmlFor={field.name} className="block text-sm font-medium text-slate-700">
              {field.label}
            </label>
            <input
              id={field.name}
              name={field.name}
              type={field.type}
              autoComplete={field.autoComplete}
              value={values[field.name]}
              onChange={handleChange}
              className={inputClassName}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={logout}
          className="rounded-lg px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
        >
          Cerrar sesión
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </form>
  );
}

function ProfileContent(): ReactElement | null {
  const { user } = useAuth();
  if (user === null) return null;

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-12">
      <div className="mx-auto w-full max-w-2xl">
        <Link href="/" className="text-sm font-medium text-emerald-600 hover:text-emerald-700">
          ← Volver al centro de control
        </Link>
        <div className="mb-8 mt-4">
          <h1 className="text-2xl font-bold text-slate-900">Mi perfil</h1>
          <p className="mt-1 text-sm text-slate-500">Gestiona tus datos de contacto.</p>
        </div>
        <ProfileForm user={user} />
      </div>
    </main>
  );
}

/** Página de gestión de la cuenta del usuario autenticado. */
export default function ProfilePage(): ReactElement {
  return (
    <AuthGuard>
      <ProfileContent />
    </AuthGuard>
  );
}
