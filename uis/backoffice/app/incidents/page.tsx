'use client';

import Link from 'next/link';
import { useState } from 'react';
import type { ReactElement } from 'react';

import { IncidentListPanel } from '@/src/components/IncidentListPanel';
import { IncidentSummaryPanel } from '@/src/components/IncidentSummaryPanel';
import { Sidebar } from '@/src/components/Sidebar';

/** Página dedicada al panel de listado y resumen de incidencias de TrackFlow. */
export default function IncidentsPage(): ReactElement {
  const [refreshTrigger, setRefreshTrigger] = useState<number>(0);

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64">
      <Sidebar />
      <main className="min-w-0">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                Gestor de Incidencias Centralizado
              </h1>
              <p className="mt-1 text-sm text-slate-500">
                Seguimiento en tiempo real y métricas de resolución para TrackFlow (US · ES)
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/incidents/new"
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700"
              >
                <span>➕ Registrar Incidencia</span>
              </Link>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
          <IncidentSummaryPanel refreshTrigger={refreshTrigger} />
          <IncidentListPanel
            refreshTrigger={refreshTrigger}
            onStatusChanged={() => setRefreshTrigger((c) => c + 1)}
          />
        </div>
      </main>
    </div>
  );
}
