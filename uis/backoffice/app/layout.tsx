import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { AuthProvider } from '@/src/contexts/AuthContext';

import './globals.css';

export const viewport: Viewport = {
  themeColor: '#0f172a',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'TrackFlow Control | Panel Operativo de Gestión Logística',
  description:
    'Centro de control de operaciones logísticas, inventario de SKUs y resolución centralizada de incidencias de TrackFlow.',
  robots: {
    index: false,
    follow: false,
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

/** Renderiza el documento base de la aplicación interna protegida. */
export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="es">
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
