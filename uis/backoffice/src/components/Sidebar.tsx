'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { ReactElement } from 'react';

type NavItem = {
  label: string;
  icon: string;
  href: string;
  isRoute?: boolean;
};

const navigation: readonly NavItem[] = [
  { label: 'Resumen General', icon: '📊', href: '/#resumen' },
  { label: 'Gestor de Incidencias', icon: '🚨', href: '/incidents', isRoute: true },
  { label: 'Registrar Incidencia', icon: '➕', href: '/incidents/new', isRoute: true },
  { label: 'Resumen Incidencias', icon: '📈', href: '/incidents/summary', isRoute: true },
  { label: 'Almacenes', icon: '🏭', href: '/#almacenes' },
  { label: 'Departamentos', icon: '👥', href: '/#clientes' },
] as const;

/** Renderiza la navegación principal del centro de control interno de TrackFlow. */
export function Sidebar(): ReactElement {
  const pathname = usePathname();
  const [activeAnchor, setActiveAnchor] = useState<string>('/#resumen');

  const isItemActive = (item: NavItem): boolean => {
    if (item.isRoute) {
      return pathname === item.href;
    }
    return pathname === '/' && activeAnchor === item.href;
  };

  return (
    <aside className="flex w-full flex-col bg-slate-900 text-white md:fixed md:inset-y-0 md:left-0 md:w-64">
      <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
        <Link href="/" className="flex items-center gap-3">
          <strong className="text-xl font-extrabold text-white">TrackFlow</strong>
          <span className="rounded bg-emerald-500 px-2 py-1 text-xs font-bold text-white">
            CONTROL
          </span>
        </Link>
      </div>
      <nav
        className="flex gap-2 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:overflow-visible md:py-6"
        aria-label="Navegación interna"
      >
        {navigation.map((item) => {
          const active = isItemActive(item);
          const classes = `flex shrink-0 items-center gap-3 rounded-r-lg border-l-4 px-4 py-3 text-sm font-medium transition ${
            active
              ? 'border-emerald-400 bg-slate-800 text-white'
              : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
          }`;

          return (
            <Link
              className={classes}
              href={item.href}
              key={item.label}
              aria-current={active ? 'page' : undefined}
              onClick={() => {
                if (!item.isRoute) {
                  setActiveAnchor(item.href);
                }
              }}
            >
              <span aria-hidden="true">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="hidden items-center gap-3 border-t border-slate-800 px-6 py-5 md:flex">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/10" />
        <div className="flex flex-col">
          <strong className="text-sm">Sistema operativo</strong>
          <small className="mt-0.5 text-xs text-slate-400">US · ES Conectado</small>
        </div>
      </div>
    </aside>
  );
}
