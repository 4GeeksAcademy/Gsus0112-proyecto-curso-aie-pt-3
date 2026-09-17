import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'TrackFlow Control',
  description: 'Centro de control operativo interno de TrackFlow.',
};

type RootLayoutProps = {
  children: ReactNode;
};

/** Renderiza el documento base de la aplicación interna. */
export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="es">
      <body className="bg-slate-50 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
