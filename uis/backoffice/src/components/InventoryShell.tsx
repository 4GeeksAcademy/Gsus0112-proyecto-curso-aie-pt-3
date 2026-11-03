'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactElement, ReactNode } from 'react';

import {
  CRITICAL_STOCK_THRESHOLD,
  LOW_STOCK_THRESHOLD,
  WAREHOUSE_LABELS,
  classifyStockLevel,
} from '../lib/inventory';
import type { WarehouseCode } from '../lib/inventory';
import { AuthGuard } from './AuthGuard';
import { Sidebar } from './Sidebar';

const INVENTORY_TABS = [
  {
    label: 'Catálogo de SKUs',
    href: '/backoffice/inventory/products',
    altHref: '/inventory/products',
    icon: '📦',
  },
  {
    label: 'Registrar Entrada (StockEntry)',
    href: '/backoffice/inventory/orders/inbound',
    altHref: '/inventory/orders/inbound',
    icon: '📥',
  },
  {
    label: 'Registrar Salida (StockExit)',
    href: '/backoffice/inventory/orders/outbound',
    altHref: '/inventory/orders/outbound',
    icon: '📤',
  },
  {
    label: 'Historial de Órdenes',
    href: '/backoffice/inventory/orders',
    altHref: '/inventory/orders',
    icon: '📋',
  },
] as const;

type InventoryShellProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
};

/**
 * Renderiza el contenedor autenticado de las vistas operativas de inventario de TrackFlow.
 * Protege todas las rutas mediante `AuthGuard` (redirige a `/login` si no hay sesión activa).
 */
export function InventoryShell({ title, subtitle, children }: InventoryShellProps): ReactElement {
  const pathname = usePathname();

  return (
    <AuthGuard>
      <div className="min-h-screen bg-slate-50 md:pl-64">
        <Sidebar />
        <main className="mx-auto min-w-0 max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <header className="mb-6 flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-700">
                <span>TrackFlow Warehouse Operations</span>
                <span aria-hidden="true">·</span>
                <span>LA &amp; ZGZ</span>
              </div>
              <h1 className="mt-1 text-2xl font-bold text-slate-900">{title}</h1>
              <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
            </div>
            <Link
              href="/"
              className="inline-flex shrink-0 items-center gap-2 self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 shadow-xs transition hover:bg-slate-100"
            >
              ← Centro de Control
            </Link>
          </header>

          <nav
            aria-label="Secciones de gestión de inventario"
            className="mb-6 flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-2 shadow-xs"
          >
            {INVENTORY_TABS.map((tab) => {
              const active = pathname === tab.href || pathname === tab.altHref;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  aria-current={active ? 'page' : undefined}
                  className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                    active
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span aria-hidden="true">{tab.icon}</span>
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>

          {children}
        </main>
      </div>
    </AuthGuard>
  );
}

/**
 * Indicador visual de nivel de stock por colores e iconografía.
 * Umbrales operativos (documentados en `src/lib/inventory.ts`):
 * - `<= CRITICAL_STOCK_THRESHOLD (10)`: Rojo — Stock crítico / Sin stock.
 * - `11..LOW_STOCK_THRESHOLD (50)`: Ámbar — Stock bajo.
 * - `> LOW_STOCK_THRESHOLD (50)`: Esmeralda — Stock saludable.
 */
export function StockLevelBadge({ currentStock }: { currentStock: number }): ReactElement {
  const { status, label, icon } = classifyStockLevel(currentStock);

  const badgeStyles =
    status === 'critical'
      ? 'border-red-300 bg-red-50 text-red-800'
      : status === 'low'
        ? 'border-amber-300 bg-amber-50 text-amber-900'
        : 'border-emerald-300 bg-emerald-50 text-emerald-800';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${badgeStyles}`}
      title={`Umbrales TrackFlow: Crítico ≤ ${CRITICAL_STOCK_THRESHOLD} | Bajo ≤ ${LOW_STOCK_THRESHOLD} | Saludable > ${LOW_STOCK_THRESHOLD}`}
    >
      <span aria-hidden="true">{icon}</span>
      <span>{currentStock} uds.</span>
      <span className="opacity-80">· {label}</span>
    </span>
  );
}

export function WarehouseBadge({ warehouse }: { warehouse: WarehouseCode }): ReactElement {
  const styles =
    warehouse === 'LA'
      ? 'border-sky-300 bg-sky-50 text-sky-800'
      : 'border-indigo-300 bg-indigo-50 text-indigo-800';

  return (
    <span
      className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-bold ${styles}`}
      title={WAREHOUSE_LABELS[warehouse]}
    >
      {warehouse === 'LA' ? '🇺🇸 LA (Los Ángeles)' : '🇪🇸 ZGZ (Zaragoza)'}
    </span>
  );
}
