'use client';

import { useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { ApiValidationError, createIncidentRequest } from '../services/incidentsApi';
import {
  BRANCH_OPTIONS,
  CATEGORY_OPTIONS,
  ORIGIN_OPTIONS,
  STATUS_OPTIONS,
} from '../types/incidents';
import type {
  Incident,
  IncidentBranch,
  IncidentCategory,
  IncidentOrigin,
  IncidentStatus,
} from '../types/incidents';

type IncidentFormProps = {
  onIncidentCreated?: (incident: Incident) => void;
};

type FormFieldKey = 'title' | 'description' | 'category' | 'origin' | 'branch' | 'status';

type FieldErrors = Partial<Record<FormFieldKey, string>>;

/** Formulario de registro en tiempo real de incidencias operativas y de clientes. */
export function IncidentRegistrationForm({
  onIncidentCreated,
}: IncidentFormProps): ReactElement {
  const [title, setTitle] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [category, setCategory] = useState<IncidentCategory | ''>('');
  const [origin, setOrigin] = useState<IncidentOrigin>('customer');
  const [branch, setBranch] = useState<IncidentBranch>('central');
  const [status, setStatus] = useState<IncidentStatus>('open');

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const isBranchOrigin = origin === 'branch';

  const validateClientSide = (): boolean => {
    const nextErrors: FieldErrors = {};

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      nextErrors.title = 'El título de la incidencia es obligatorio.';
    } else if (cleanTitle.length > 120) {
      nextErrors.title = 'El título no puede superar los 120 caracteres.';
    }

    const cleanDesc = description.trim();
    if (!cleanDesc) {
      nextErrors.description = 'La descripción detallada es obligatoria.';
    } else if (cleanDesc.length < 5) {
      nextErrors.description = 'La descripción debe tener al menos 5 caracteres.';
    }

    if (!category) {
      nextErrors.category = 'Selecciona una categoría válida del listado.';
    }

    if (!origin) {
      nextErrors.origin = 'Selecciona el origen del reporte.';
    }

    if (!branch) {
      nextErrors.branch = 'Selecciona la sede que gestiona o reporta la incidencia.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const clearFieldError = (field: FormFieldKey): void => {
    if (fieldErrors[field]) {
      setFieldErrors((prev) => {
        const copy = { ...prev };
        delete copy[field];
        return copy;
      });
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setGeneralError(null);
    setSuccessMessage(null);

    if (!validateClientSide() || !category) {
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createIncidentRequest({
        title: title.trim(),
        description: description.trim(),
        category,
        origin,
        branch,
        status,
      });

      setTitle('');
      setDescription('');
      setCategory('');
      setOrigin('customer');
      setBranch('central');
      setStatus('open');
      setFieldErrors({});
      setSuccessMessage(
        `Incidencia #${created.id} ("${created.title}") registrada correctamente en el sistema central.`,
      );

      if (onIncidentCreated) {
        onIncidentCreated(created);
      }
    } catch (error: unknown) {
      if (error instanceof ApiValidationError) {
        if (
          error.field &&
          ['title', 'description', 'category', 'origin', 'branch', 'status'].includes(error.field)
        ) {
          setFieldErrors((prev) => ({
            ...prev,
            [error.field as FormFieldKey]: error.message,
          }));
        } else {
          setGeneralError(error.message);
        }
      } else {
        setGeneralError(
          'No se pudo completar el registro de la incidencia. Por favor, revisa los datos e inténtalo de nuevo.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 border-b border-slate-100 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
          Registro en Tiempo Real
        </span>
        <h3 className="mt-1 text-xl font-bold text-slate-900">Registrar Nueva Incidencia</h3>
        <p className="mt-1 text-sm text-slate-500">
          Completa todos los campos para dar de alta una incidencia operativa, de sede o de cliente.
        </p>
      </div>

      {successMessage ? (
        <div
          role="status"
          className="mb-6 flex items-start justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900"
        >
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 font-bold text-emerald-600" aria-hidden="true">
              ✓
            </span>
            <div>
              <p className="font-semibold">Registro confirmado</p>
              <p className="mt-0.5 text-emerald-800">{successMessage}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900"
          >
            Cerrar
          </button>
        </div>
      ) : null}

      {generalError ? (
        <div
          role="alert"
          className="mb-6 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900"
        >
          <p className="font-semibold">No se pudo guardar la incidencia</p>
          <p className="mt-1 text-rose-800">{generalError}</p>
        </div>
      ) : null}

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        <div>
          <label htmlFor="incident-title" className="block text-sm font-semibold text-slate-800">
            Título de la incidencia <span className="text-rose-600">*</span>
          </label>
          <input
            id="incident-title"
            name="title"
            type="text"
            maxLength={120}
            value={title}
            disabled={isSubmitting}
            onChange={(e) => {
              setTitle(e.target.value);
              clearFieldError('title');
            }}
            placeholder="Ej. Paquete retenido en centro de clasificación sin escaneo de salida"
            className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition ${
              fieldErrors.title
                ? 'border-rose-500 bg-rose-50/40 focus:border-rose-600'
                : 'border-slate-300 bg-white focus:border-emerald-600'
            }`}
          />
          {fieldErrors.title ? (
            <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
              {fieldErrors.title}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              Máximo 120 caracteres ({title.trim().length}/120).
            </p>
          )}
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="incident-origin" className="block text-sm font-semibold text-slate-800">
              Origen del reporte <span className="text-rose-600">*</span>
            </label>
            <select
              id="incident-origin"
              name="origin"
              value={origin}
              disabled={isSubmitting}
              onChange={(e) => {
                const nextOrigin = e.target.value as IncidentOrigin;
                setOrigin(nextOrigin);
                clearFieldError('origin');
              }}
              className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition ${
                fieldErrors.origin
                  ? 'border-rose-500 bg-rose-50/40 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-emerald-600'
              }`}
            >
              {ORIGIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.value})
                </option>
              ))}
            </select>
            {fieldErrors.origin ? (
              <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
                {fieldErrors.origin}
              </p>
            ) : null}
          </div>

          <div
            className={`rounded-xl p-3 transition-all ${
              isBranchOrigin
                ? 'border-2 border-amber-400 bg-amber-50/80 ring-4 ring-amber-200/50'
                : 'border border-transparent p-0'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="incident-branch"
                className="block text-sm font-semibold text-slate-800"
              >
                Sede (branch) <span className="text-rose-600">*</span>
              </label>
              {isBranchOrigin ? (
                <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-xs font-bold text-amber-900">
                  Reporte desde sede específica
                </span>
              ) : null}
            </div>
            <select
              id="incident-branch"
              name="branch"
              value={branch}
              disabled={isSubmitting}
              onChange={(e) => {
                setBranch(e.target.value as IncidentBranch);
                clearFieldError('branch');
              }}
              className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition ${
                fieldErrors.branch
                  ? 'border-rose-500 bg-rose-50/40 focus:border-rose-600'
                  : isBranchOrigin
                    ? 'border-amber-500 bg-white font-semibold focus:border-amber-600'
                    : 'border-slate-300 bg-white focus:border-emerald-600'
              }`}
            >
              {BRANCH_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {isBranchOrigin ? (
              <p className="mt-1.5 text-xs font-medium text-amber-900">
                Estás registrando una incidencia con origen en sede operativa. Verifica que la sede seleccionada corresponda al almacén u oficina afectada.
              </p>
            ) : (
              <p className="mt-1 text-xs text-slate-400">
                Usa &quot;Central&quot; cuando no corresponda a una sede específica.
              </p>
            )}
            {fieldErrors.branch ? (
              <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
                {fieldErrors.branch}
              </p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label
              htmlFor="incident-category"
              className="block text-sm font-semibold text-slate-800"
            >
              Categoría <span className="text-rose-600">*</span>
            </label>
            <select
              id="incident-category"
              name="category"
              value={category}
              disabled={isSubmitting}
              onChange={(e) => {
                setCategory(e.target.value as IncidentCategory | '');
                clearFieldError('category');
              }}
              className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition ${
                fieldErrors.category
                  ? 'border-rose-500 bg-rose-50/40 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-emerald-600'
              }`}
            >
              <option value="">Selecciona una categoría...</option>
              {CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.shortLabel}
                </option>
              ))}
            </select>
            {fieldErrors.category ? (
              <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
                {fieldErrors.category}
              </p>
            ) : null}
          </div>

          <div>
            <label htmlFor="incident-status" className="block text-sm font-semibold text-slate-800">
              Estado inicial <span className="text-rose-600">*</span>
            </label>
            <select
              id="incident-status"
              name="status"
              value={status}
              disabled={isSubmitting}
              onChange={(e) => {
                setStatus(e.target.value as IncidentStatus);
                clearFieldError('status');
              }}
              className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition ${
                fieldErrors.status
                  ? 'border-rose-500 bg-rose-50/40 focus:border-rose-600'
                  : 'border-slate-300 bg-white focus:border-emerald-600'
              }`}
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} ({opt.value})
                </option>
              ))}
            </select>
            {fieldErrors.status ? (
              <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
                {fieldErrors.status}
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label
            htmlFor="incident-description"
            className="block text-sm font-semibold text-slate-800"
          >
            Descripción detallada <span className="text-rose-600">*</span>
          </label>
          <textarea
            id="incident-description"
            name="description"
            rows={4}
            value={description}
            disabled={isSubmitting}
            onChange={(e) => {
              setDescription(e.target.value);
              clearFieldError('description');
            }}
            placeholder="Describe qué ocurrió, transportista o SKU implicado, e impacto operativo..."
            className={`mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-sm text-slate-900 shadow-xs outline-none transition ${
              fieldErrors.description
                ? 'border-rose-500 bg-rose-50/40 focus:border-rose-600'
                : 'border-slate-300 bg-white focus:border-emerald-600'
            }`}
          />
          {fieldErrors.description ? (
            <p className="mt-1.5 text-xs font-semibold text-rose-600" role="alert">
              {fieldErrors.description}
            </p>
          ) : (
            <p className="mt-1 text-xs text-slate-400">
              Mínimo 5 caracteres con el contexto necesario para soporte u operaciones.
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4">
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />
                <span>Registrando incidencia...</span>
              </>
            ) : (
              <span>Registrar incidencia</span>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
