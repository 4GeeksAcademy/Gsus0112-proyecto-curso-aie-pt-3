import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Inter } from 'next/font/google';

import './globals.css';

const inter = Inter({
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TrackFlow | People & Talent Pipeline',
  description: 'Talent Pipeline Tracker para el equipo de People & Talent de TrackFlow',
};

type RootLayoutProps = {
  children: ReactNode;
};

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} min-h-full bg-slate-50 text-slate-900 antialiased`}>
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 py-4 md:px-8">
            <p className="text-lg font-medium text-slate-800">
              <span className="font-bold text-teal-600">TrackFlow</span> | People & Talent
            </p>
            <nav>
              <Link href="/" className="text-sm font-semibold text-slate-700 transition-colors hover:text-teal-700">
                Candidaturas
              </Link>
            </nav>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl">{children}</div>
      </body>
    </html>
  );
}
