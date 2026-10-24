import type { ReactElement } from 'react';

import { CentralizedIncidentManager } from '@/src/components/CentralizedIncidentManager';
import { KpiGrid } from '@/src/components/KpiGrid';
import { OperationsPanel } from '@/src/components/OperationsPanel';
import { Sidebar } from '@/src/components/Sidebar';
import { WarehouseHealth } from '@/src/components/WarehouseHealth';

/** Renderiza el resumen operativo principal del backoffice junto con el gestor centralizado de incidencias. */
export default function DashboardPage(): ReactElement {
  return (
    <div id="resumen" className="min-h-screen scroll-mt-4 bg-slate-50 md:pl-64">
      <Sidebar />
      <main className="min-w-0">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Centro de Control</h1>
              <p className="mt-1 text-sm text-slate-500">TrackFlow Operations & Incident Management Dashboard</p>
            </div>
            <div className="flex items-center gap-3 text-sm text-slate-500">
              <span className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">US · ES</span>
              <time className="font-medium text-slate-700" dateTime="2026-10-23">23 OCT 2026</time>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <p className="mb-5 text-sm font-medium text-slate-500">Vista operativa de la red TrackFlow</p>
          <KpiGrid />
          <CentralizedIncidentManager />
          <WarehouseHealth />
          <OperationsPanel />
        </div>
      </main>
    </div>
  );
}
