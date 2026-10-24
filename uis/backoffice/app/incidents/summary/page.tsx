import Link from 'next/link';
import type { ReactElement } from 'react';

import { IncidentSummaryPanel } from '@/src/components/IncidentSummaryPanel';
import { Sidebar } from '@/src/components/Sidebar';

/** Página dedicada al resumen agregado de incidencias. */
export default function IncidentsSummaryPage(): ReactElement {
  return (
    <div className="min-h-screen bg-slate-50 md:pl-64">
      <Sidebar />
      <main className="min-w-0">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Resumen Ejecutivo de Incidencias
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Métricas agregadas por estado, categoría, origen y sede en TrackFlow
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/incidents/new"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              >
                <span>➕ Registrar Incidencia</span>
              </Link>
              <Link
                href="/incidents"
                className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-xs transition hover:bg-slate-50"
              >
                <span>Ver listado</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <IncidentSummaryPanel />
        </div>
      </main>
    </div>
  );
}
