'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ChangeEvent, FormEvent, ReactElement } from 'react';

import { useAuth } from '@/src/contexts/AuthContext';
import { API_BASE_URL } from '@/src/utils/api';
import {
  EMPTY_FORM,
  PASSWORD_MAX_LENGTH,
  buildRegistrationPayload,
  parseApiError,
  validateRegistrationForm,
} from '@/src/utils/authValidators';
import type { FieldErrors, FieldName, FormValues } from '@/src/utils/authValidators';

const FIELDS: { name: FieldName; label: string; type: string; autoComplete: string; required: boolean }[] = [
  { name: 'email', label: 'Email', type: 'email', autoComplete: 'email', required: true },
  { name: 'password', label: 'Contraseña', type: 'password', autoComplete: 'new-password', required: true },
  { name: 'name', label: 'Nombre', type: 'text', autoComplete: 'name', required: false },
  { name: 'phone', label: 'Teléfono', type: 'tel', autoComplete: 'tel', required: false },
  { name: 'address', label: 'Dirección', type: 'text', autoComplete: 'street-address', required: false },
];

const inputBaseClassName =
  'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 shadow-sm placeholder:text-slate-400 focus:outline-none focus:ring-2';

/** Formulario de alta de nuevos usuarios con auto-login tras el registro. */
export default function RegisterPage(): ReactElement {
  const { login } = useAuth();
  const router = useRouter();
  const [values, setValues] = useState<FormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const name = event.target.name as FieldName;
    setValues((current) => ({ ...current, [name]: event.target.value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError('');

    const localErrors = validateRegistrationForm(values);
    setFieldErrors(localErrors);
    if (Object.keys(localErrors).length > 0) return;

    const payload = buildRegistrationPayload(values);

    setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE_URL}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const parsed = await parseApiError(response);
        setFieldErrors(parsed.fieldErrors);
        setError(parsed.message);
        return;
      }

      await login(payload.email, payload.password);
      router.replace('/');
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'No se pudo conectar con la API. Comprueba que el servidor está en marcha.'
          : err instanceof Error
            ? err.message
            : 'No se pudo completar el registro.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-lg">
        <div className="mb-8 text-center">
          <p className="text-sm font-semibold uppercase tracking-wider text-emerald-600">TrackFlow Control</p>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Crea tu cuenta</h1>
          <p className="mt-1 text-sm text-slate-500">Los datos de contacto son opcionales.</p>
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
                <Link href="/login" className="font-semibold text-red-800 underline hover:text-red-950">
                  Ir a iniciar sesión
                </Link>
                <span className="text-red-600">
                  Si necesitas ayuda, escribe a soporte@trackflow.com
                </span>
              </div>
            </div>
          )}

          <div className="grid gap-5 sm:grid-cols-2">
            {FIELDS.map((field) => {
              const fieldError = fieldErrors[field.name];
              return (
                <div key={field.name} className={field.name === 'address' ? 'sm:col-span-2' : undefined}>
                  <label htmlFor={field.name} className="block text-sm font-medium text-slate-700">
                    {field.label}
                    {field.required ? (
                      <span className="text-red-500"> *</span>
                    ) : (
                      <span className="font-normal text-slate-400"> (opcional)</span>
                    )}
                  </label>
                  <input
                    id={field.name}
                    name={field.name}
                    type={field.type}
                    autoComplete={field.autoComplete}
                    required={field.required}
                    maxLength={field.name === 'password' ? PASSWORD_MAX_LENGTH : undefined}
                    value={values[field.name]}
                    onChange={handleChange}
                    aria-invalid={fieldError !== undefined}
                    aria-describedby={fieldError ? `${field.name}-error` : undefined}
                    className={`${inputBaseClassName} ${
                      fieldError
                        ? 'border-red-400 focus:border-red-500 focus:ring-red-500/20'
                        : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-500/20'
                    }`}
                  />
                  {fieldError && (
                    <p id={`${field.name}-error`} className="mt-1 text-xs text-red-600">
                      {fieldError}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>

          <p className="text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?{' '}
            <Link href="/login" className="font-medium text-emerald-600 hover:text-emerald-700">
              Inicia sesión
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
