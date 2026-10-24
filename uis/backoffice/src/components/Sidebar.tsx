'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import type { ReactElement } from 'react';

const navigation = [
  { label: 'Resumen', icon: '📊', href: '#resumen' },
  { label: 'Gestor de Incidencias', icon: '🚨', href: '/incidents' },
  { label: 'Registrar Incidencia', icon: '➕', href: '/incidents/new' },
  { label: 'Resumen Incidencias', icon: '📈', href: '/incidents/summary' },
  { label: 'Almacenes', icon: '🏭', href: '#almacenes' },
  { label: 'Envíos', icon: '📦', href: '#envios' },
  { label: 'Devoluciones', icon: '🔄', href: '#devoluciones' },
  { label: 'Incidencias', icon: '📁', href: '#incidencias' },
  { label: 'Clientes', icon: '👥', href: '#clientes' },
  { label: 'Directorio de Proveedores', icon: '🚚', href: '/suppliers' },
];

/** Renderiza la navegación propia del centro de control interno. */
export function Sidebar(): ReactElement {
  const [activeSection, setActiveSection] = useState<string>('#resumen');
  const pathname = usePathname();

  const isActive = (href: string): boolean =>
    href.startsWith('/')
      ? pathname === href
      : pathname === '/' && activeSection === href;

  return (
    <aside className="flex w-full flex-col bg-slate-900 text-white md:fixed md:inset-y-0 md:left-0 md:w-64">
      <div className="flex h-20 items-center gap-3 border-b border-slate-800 px-6">
        <strong className="text-xl font-extrabold">TrackFlow</strong>
        <span className="rounded bg-emerald-500 px-2 py-1 text-xs font-bold text-white">CONTROL</span>
      </div>
      <nav
        className="flex gap-2 overflow-x-auto px-3 py-3 md:flex-1 md:flex-col md:overflow-visible md:py-6"
        aria-label="Navegación interna"
      >
        {navigation.map((item) => (
          <a
            className={`flex shrink-0 items-center gap-3 rounded-r-lg border-l-4 px-4 py-3 text-sm font-medium transition ${
              isActive(item.href)
                ? 'border-emerald-400 bg-slate-800 text-white'
                : 'border-transparent text-slate-400 hover:bg-slate-800 hover:text-white'
            }`}
            href={item.href.startsWith('#') && pathname !== '/' ? `/${item.href}` : item.href}
            key={item.label}
            aria-current={isActive(item.href) ? 'page' : undefined}
            onClick={() => setActiveSection(item.href)}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </a>
        ))}
      </nav>
      <div className="hidden items-center gap-3 border-t border-slate-800 px-6 py-5 md:flex">
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 ring-4 ring-emerald-400/10" />
        <div className="flex flex-col">
          <strong className="text-sm">Sistema operativo</strong>
          <small className="mt-0.5 text-xs text-slate-400">Última revisión: ahora</small>
        </div>
      </div>
    </aside>
  );
}
