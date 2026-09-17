import type { Metadata } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const metadata: Metadata = {
  title: 'TrackFlow | Logística sin fronteras',
  description: 'Logística de última milla, almacenes y devoluciones para marcas en Estados Unidos y España.',
};

type RootLayoutProps = {
  children: ReactNode;
};

/** Renderiza el documento base de la web pública de TrackFlow. */
export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="es">
      <body className="bg-white font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
