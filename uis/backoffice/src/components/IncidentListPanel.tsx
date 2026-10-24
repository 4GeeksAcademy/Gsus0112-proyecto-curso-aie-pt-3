'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import {
  ApiValidationError,
  fetchIncidents,
  updateIncidentStatusRequest,
} from '../services/incidentsApi';
import {
  ALLOWED_STATUS_TRANSITIONS,
  BRANCH_LABELS,
  BRANCH_OPTIONS,
  CATEGORY_LABELS,
  ORIGIN_LABELS,
  ORIGIN_OPTIONS,
  STATUS_LABELS,
  STATUS_OPTIONS,
} from '../types/incidents';
import type {
  Incident,
  IncidentBranch,
  IncidentOrigin,
  IncidentStatus,
} from '../types/incidents';

type IncidentListPanelProps = {
  refreshTrigger?: number;
  onStatusChanged?: () => void;
};

function getStatusBadgeClasses(status: IncidentStatus): string {
  switch (status) {
    case 'open':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'in_progress':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'resolved':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'discarded':
      return 'bg-slate-200 text-slate-700 border-slate-300';
  }
}

function formatDate(isoString: string): string {
  if (!isoString) return '—';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return isoString;
  }
  return parsed.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}

/** Panel de listado de incidencias con filtros y actualización de estado en tiempo real. */
export function IncidentListPanel({
  refreshTrigger = 0,
  onStatusChanged,
}: IncidentListPanelProps): ReactElement {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [statusFilter, setStatusFilter] = useState<IncidentStatus | ''>('');
  const [originFilter, setOriginFilter] = useState<IncidentOrigin | ''>('');
  const [branchFilter, setBranchFilter] = useState<IncidentBranch | ''>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState<number>(0);

  const [updatingIds, setUpdatingIds] = useState<Record<number, boolean>>({});
  const [statusFeedback, setStatusFeedback] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);

  const loadIncidents = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await fetchIncidents({
        status: statusFilter,
        origin: originFilter,
        branch: branchFilter,
      });
      setIncidents(data);
    } catch (error: unknown) {
      if (error instanceof ApiValidationError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg(
          'No se pudieron cargar las incidencias en este momento. Comprueba la conexión e inténtalo de nuevo.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, originFilter, branchFilter]);

  useEffect(() => {
    void loadIncidents();
  }, [loadIncidents, refreshTrigger, retryCounter]);

  const handleStatusChange = async (
    incident: Incident,
    nextStatus: IncidentStatus,
  ): Promise<void> => {
    if (nextStatus === incident.status) return;

    const previousStatus = incident.status;
    setStatusFeedback(null);

    setIncidents((prev) =>
      prev.map((item) =>
        item.id === incident.id ? { ...item, status: nextStatus } : item,
      ),
    );
    setUpdatingIds((prev) => ({ ...prev, [incident.id]: true }));

    try {
      const updated = await updateIncidentStatusRequest(incident.id, nextStatus);
      setIncidents((prev) =>
        prev.map((item) => (item.id === incident.id ? updated : item)),
      );
      setStatusFeedback({
        type: 'success',
        message: `El estado de la incidencia #${incident.id} se actualizó a "${STATUS_LABELS[updated.status]}".`,
      });
      if (onStatusChanged) {
        onStatusChanged();
      }
    } catch (error: unknown) {
      setIncidents((prev) =>
        prev.map((item) =>
          item.id === incident.id ? { ...item, status: previousStatus } : item,
        ),
      );
      const message =
        error instanceof ApiValidationError
          ? error.message
          : 'No se pudo actualizar el estado de la incidencia. Se ha restaurado su estado anterior.';
      setStatusFeedback({
        type: 'error',
        message: `Incidencia #${incident.id}: ${message}`,
      });
    } finally {
      setUpdatingIds((prev) => {
        const copy = { ...prev };
        delete copy[incident.id];
        return copy;
      });
    }
  };

  const hasActiveFilters = Boolean(statusFilter || originFilter || branchFilter);

  const resetFilters = (): void => {
    setStatusFilter('');
    setOriginFilter('');
    setBranchFilter('');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Seguimiento Operativo
          </span>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Panel de Incidencias</h3>
          <p className="mt-1 text-sm text-slate-500">
            Consulta y gestiona el ciclo de vida de todas las incidencias registradas en TrackFlow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Limpiar filtros
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setRetryCounter((c) => c + 1)}
            disabled={isLoading}
            className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
          >
            Actualizar listado
          </button>
        </div>
      </div>

      {/* Controles de filtro por status, origin y branch */}
      <div className="mb-6 grid gap-4 rounded-xl border border-slate-200 bg-slate-50/70 p-4 sm:grid-cols-3">
        <div>
          <label htmlFor="filter-status" className="block text-xs font-bold uppercase text-slate-600">
            Filtrar por Estado (status)
          </label>
          <select
            id="filter-status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as IncidentStatus | '')}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
          >
            <option value="">Todos los estados</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.value})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-origin" className="block text-xs font-bold uppercase text-slate-600">
            Filtrar por Origen (origin)
          </label>
          <select
            id="filter-origin"
            value={originFilter}
            onChange={(e) => setOriginFilter(e.target.value as IncidentOrigin | '')}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
          >
            <option value="">Todos los orígenes</option>
            {ORIGIN_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label} ({opt.value})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="filter-branch" className="block text-xs font-bold uppercase text-slate-600">
            Filtrar por Sede (branch)
          </label>
          <select
            id="filter-branch"
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value as IncidentBranch | '')}
            className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600"
          >
            <option value="">Todas las sedes</option>
            {BRANCH_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {statusFeedback ? (
        <div
          role="alert"
          className={`mb-5 flex items-center justify-between gap-3 rounded-lg border px-4 py-3 text-sm ${
            statusFeedback.type === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : 'border-emerald-200 bg-emerald-50 text-emerald-900'
          }`}
        >
          <span>{statusFeedback.message}</span>
          <button
            type="button"
            onClick={() => setStatusFeedback(null)}
            className="text-xs font-bold underline"
          >
            Cerrar
          </button>
        </div>
      ) : null}

      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-slate-50/50 py-14 text-slate-600">
          <span className="h-7 w-7 animate-spin rounded-full border-3 border-slate-300 border-t-emerald-600" />
          <p className="mt-3 text-sm font-medium">Cargando incidencias registradas...</p>
        </div>
      ) : null}

      {!isLoading && errorMsg ? (
        <div
          role="alert"
          className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900"
        >
          <h4 className="text-base font-bold">No se pudo obtener el listado de incidencias</h4>
          <p className="mt-1 text-sm text-rose-800">{errorMsg}</p>
          <button
            type="button"
            onClick={() => setRetryCounter((c) => c + 1)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-700"
          >
            Reintentar carga
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMsg && incidents.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/60 px-6 py-12 text-center">
          <p className="text-base font-bold text-slate-800">
            {hasActiveFilters
              ? 'No se encontraron incidencias para los filtros seleccionados'
              : 'Aún no hay incidencias registradas en el sistema'}
          </p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            {hasActiveFilters
              ? 'Prueba cambiando los criterios de estado, origen o sede, o limpia los filtros para ver todos los registros.'
              : 'Registra una nueva incidencia desde el formulario o ejecuta el script de carga histórica (seed_incidents.py).'}
          </p>
          {hasActiveFilters ? (
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 inline-flex rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
            >
              Ver todas las incidencias
            </button>
          ) : null}
        </div>
      ) : null}

      {!isLoading && !errorMsg && incidents.length > 0 ? (
        <div>
          <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
            <span>
              Mostrando <strong className="text-slate-800">{incidents.length}</strong>{' '}
              {incidents.length === 1 ? 'incidencia' : 'incidencias'}
            </span>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full border-collapse text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">ID / Fecha</th>
                  <th className="px-4 py-3 font-semibold">Incidencia</th>
                  <th className="px-4 py-3 font-semibold">Categoría</th>
                  <th className="px-4 py-3 font-semibold">Origen · Sede</th>
                  <th className="px-4 py-3 font-semibold">Estado y Transición</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {incidents.map((item) => {
                  const allowedNext = ALLOWED_STATUS_TRANSITIONS[item.status] ?? [];
                  const isRowUpdating = Boolean(updatingIds[item.id]);
                  const selectableStatuses: IncidentStatus[] = [
                    item.status,
                    ...allowedNext,
                  ];

                  return (
                    <tr key={item.id} className="align-top transition hover:bg-slate-50/80">
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          #{item.id}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {formatDate(item.created_at)}
                        </span>
                      </td>
                      <td className="max-w-md px-4 py-3.5">
                        <p className="font-semibold text-slate-900">{item.title}</p>
                        {item.description !== item.title ? (
                          <p className="mt-0.5 line-clamp-2 text-xs text-slate-600">
                            {item.description}
                          </p>
                        ) : null}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800">
                          {CATEGORY_LABELS[item.category] ?? item.category}
                        </span>
                        <span className="mt-0.5 block font-mono text-[11px] text-slate-400">
                          {item.category}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="text-xs font-semibold text-slate-800">
                          {ORIGIN_LABELS[item.origin] ?? item.origin}
                        </span>
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {BRANCH_LABELS[item.branch] ?? item.branch}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <div className="flex flex-col gap-1.5">
                          <span
                            className={`inline-flex w-fit items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${getStatusBadgeClasses(
                              item.status,
                            )}`}
                          >
                            {STATUS_LABELS[item.status] ?? item.status}
                          </span>
                          {allowedNext.length > 0 ? (
                            <div className="flex items-center gap-1.5">
                              <select
                                aria-label={`Actualizar estado de incidencia ${item.id}`}
                                value={item.status}
                                disabled={isRowUpdating}
                                onChange={(e) =>
                                  void handleStatusChange(
                                    item,
                                    e.target.value as IncidentStatus,
                                  )
                                }
                                className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 outline-none focus:border-emerald-600 disabled:opacity-50"
                              >
                                {selectableStatuses.map((st) => (
                                  <option key={st} value={st}>
                                    {st === item.status
                                      ? `Cambiar (${STATUS_LABELS[st]})...`
                                      : `→ ${STATUS_LABELS[st]} (${st})`}
                                  </option>
                                ))}
                              </select>
                              {isRowUpdating ? (
                                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-[11px] text-slate-400">Estado final</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
