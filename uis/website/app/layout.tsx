import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import './globals.css';

export const viewport: Viewport = {
  themeColor: '#047857',
  width: 'device-width',
  initialScale: 1,
};

export const metadata: Metadata = {
  title: 'TrackFlow | Logística Integral y Envíos Transfronterizos',
  description:
    'Plataforma de logística de última milla, fulfillment de inventario y devoluciones automatizadas conectando marcas y almacenes en Estados Unidos y España.',
  metadataBase: new URL('https://trackflow.com'),
  keywords: [
    'logística',
    'fulfillment',
    'última milla',
    'gestión de inventario',
    'cross-docking',
    'devoluciones',
    'TrackFlow',
  ],
  authors: [{ name: 'TrackFlow Logistics Tech' }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: 'TrackFlow | Logística Integral y Envíos Transfronterizos',
    description:
      'Conecta tu inventario con cada puerta, sin perder el control físico ni digital.',
    url: 'https://trackflow.com',
    siteName: 'TrackFlow',
    locale: 'es_ES',
    type: 'website',
  },
};

type RootLayoutProps = {
  children: ReactNode;
};

/** Renderiza el documento base de la web pública de TrackFlow optimizado para SEO y accesibilidad. */
export default function RootLayout({ children }: RootLayoutProps): ReactNode {
  return (
    <html lang="es" className="scroll-smooth">
      <body className="bg-white font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
