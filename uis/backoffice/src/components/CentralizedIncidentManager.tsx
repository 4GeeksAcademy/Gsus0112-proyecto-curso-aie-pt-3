'use client';

import { useState } from 'react';
import type { ReactElement } from 'react';

import { IncidentListPanel } from './IncidentListPanel';
import { IncidentRegistrationForm } from './IncidentRegistrationForm';
import { IncidentSummaryPanel } from './IncidentSummaryPanel';

type ViewMode = 'all' | 'register' | 'list' | 'summary';

/** Gestor de Incidencias Centralizado de TrackFlow con registro, listado y resumen. */
export function CentralizedIncidentManager(): ReactElement {
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>('all');

  const triggerRefresh = (): void => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <section id="incidencias" className="mt-10 scroll-mt-6 space-y-8">
      <div className="flex flex-col gap-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-slate-900 to-slate-800 p-6 text-white shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-bold uppercase tracking-wider text-emerald-300">
            TrackFlow Incident Manager
          </span>
          <h2 className="mt-2 text-2xl font-bold text-white">
            Gestor de Incidencias Centralizado
          </h2>
          <p className="mt-1 text-sm text-slate-300">
            Registro en tiempo real, trazabilidad por ciclo de vida y métricas operativas para Estados Unidos y España.
          </p>
        </div>
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Vistas del gestor de incidencias">
          <button
            type="button"
            onClick={() => setViewMode('all')}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              viewMode === 'all'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Vista completa
          </button>
          <button
            type="button"
            onClick={() => setViewMode('register')}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              viewMode === 'register'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Formulario de registro
          </button>
          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              viewMode === 'list'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Panel de listado
          </button>
          <button
            type="button"
            onClick={() => setViewMode('summary')}
            className={`rounded-lg px-3.5 py-2 text-xs font-semibold transition ${
              viewMode === 'summary'
                ? 'bg-emerald-500 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white'
            }`}
          >
            Panel de resumen
          </button>
        </div>
      </div>

      {viewMode === 'all' || viewMode === 'summary' ? (
        <div id="resumen-incidencias" className="scroll-mt-6">
          <IncidentSummaryPanel refreshTrigger={refreshTrigger} />
        </div>
      ) : null}

      {viewMode === 'all' || viewMode === 'register' ? (
        <div id="registro-incidencias" className="scroll-mt-6">
          <IncidentRegistrationForm onIncidentCreated={triggerRefresh} />
        </div>
      ) : null}

      {viewMode === 'all' || viewMode === 'list' ? (
        <div id="listado-incidencias" className="scroll-mt-6">
          <IncidentListPanel
            refreshTrigger={refreshTrigger}
            onStatusChanged={triggerRefresh}
          />
        </div>
      ) : null}
    </section>
  );
}
