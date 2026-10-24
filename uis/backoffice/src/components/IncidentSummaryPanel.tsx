'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ReactElement } from 'react';

import { ApiValidationError, fetchIncidentsSummary } from '../services/incidentsApi';
import {
  BRANCH_OPTIONS,
  CATEGORY_LABELS,
  CATEGORY_OPTIONS,
  ORIGIN_OPTIONS,
  STATUS_OPTIONS,
} from '../types/incidents';
import type { IncidentSummary } from '../types/incidents';

type IncidentSummaryPanelProps = {
  refreshTrigger?: number;
};

/** Panel de resumen ejecutivo con métricas agregadas del endpoint /api/incidents/summary. */
export function IncidentSummaryPanel({
  refreshTrigger = 0,
}: IncidentSummaryPanelProps): ReactElement {
  const [summary, setSummary] = useState<IncidentSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryCounter, setRetryCounter] = useState<number>(0);

  const loadSummary = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    setErrorMsg(null);

    try {
      const data = await fetchIncidentsSummary();
      setSummary(data);
    } catch (error: unknown) {
      if (error instanceof ApiValidationError) {
        setErrorMsg(error.message);
      } else {
        setErrorMsg(
          'No se pudieron cargar las métricas agregadas del resumen. Puedes reintentar sin afectar el resto del panel.',
        );
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary, refreshTrigger, retryCounter]);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-emerald-600">
            Métricas Agregadas (/api/incidents/summary)
          </span>
          <h3 className="mt-1 text-xl font-bold text-slate-900">Panel de Resumen de Incidencias</h3>
          <p className="mt-1 text-sm text-slate-500">
            Totales consolidados por estado, categoría, origen y sede para dirección y operaciones.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setRetryCounter((c) => c + 1)}
          disabled={isLoading}
          className="w-fit rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
        >
          Actualizar métricas
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-3 rounded-xl border border-slate-200 bg-slate-50/50 py-10 text-slate-600">
          <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-emerald-600" />
          <span className="text-sm font-medium">Calculando métricas agregadas...</span>
        </div>
      ) : null}

      {!isLoading && errorMsg ? (
        <div
          role="alert"
          className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
        >
          <p className="text-sm font-bold">Métricas temporalmente no disponibles</p>
          <p className="mt-1 text-xs text-amber-900">{errorMsg}</p>
          <button
            type="button"
            onClick={() => setRetryCounter((c) => c + 1)}
            className="mt-3 inline-flex rounded-lg bg-amber-700 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-amber-800"
          >
            Reintentar resumen
          </button>
        </div>
      ) : null}

      {!isLoading && !errorMsg && summary ? (
        <div className="space-y-6">
          {/* Totales por estado */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Total por Estado (status)
              </h4>
              <span className="rounded-full bg-emerald-100 px-3 py-0.5 text-xs font-bold text-emerald-800">
                Total global: {summary.total}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {STATUS_OPTIONS.map((st) => {
                const count = summary.by_status?.[st.value] ?? 0;
                return (
                  <div
                    key={st.value}
                    className="rounded-xl border border-slate-200 bg-slate-50/70 p-4"
                  >
                    <span className="text-xs font-semibold text-slate-500">
                      {st.label} ({st.value})
                    </span>
                    <strong className="mt-1.5 block text-2xl font-extrabold text-slate-900">
                      {count}
                    </strong>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Total por categoría */}
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Total por Categoría (category)
              </h4>
              <ul className="divide-y divide-slate-100 text-sm">
                {CATEGORY_OPTIONS.map((cat) => {
                  const count = summary.by_category?.[cat.value] ?? 0;
                  return (
                    <li
                      key={cat.value}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div>
                        <span className="font-medium text-slate-800">
                          {CATEGORY_LABELS[cat.value]}
                        </span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {cat.value}
                        </span>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-900">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Total por origen */}
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Total por Origen (origin)
              </h4>
              <ul className="divide-y divide-slate-100 text-sm">
                {ORIGIN_OPTIONS.map((orig) => {
                  const count = summary.by_origin?.[orig.value] ?? 0;
                  return (
                    <li
                      key={orig.value}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div>
                        <span className="font-medium text-slate-800">{orig.label}</span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {orig.value}
                        </span>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-900">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Total por sede */}
            <div className="rounded-xl border border-slate-200 p-4">
              <h4 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-500">
                Total por Sede (branch)
              </h4>
              <ul className="divide-y divide-slate-100 text-sm">
                {BRANCH_OPTIONS.map((br) => {
                  const count = summary.by_branch?.[br.value] ?? 0;
                  return (
                    <li
                      key={br.value}
                      className="flex items-center justify-between gap-2 py-2.5"
                    >
                      <div>
                        <span className="font-medium text-slate-800">{br.label}</span>
                        <span className="block font-mono text-[11px] text-slate-400">
                          {br.value}
                        </span>
                      </div>
                      <span className="rounded-md bg-slate-100 px-2.5 py-1 font-mono text-xs font-bold text-slate-900">
                        {count}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
