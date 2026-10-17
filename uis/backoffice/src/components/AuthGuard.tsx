'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from '../contexts/AuthContext';

type AuthGuardProps = {
  children: ReactNode;
};

/** Muestra su contenido solo a usuarios autenticados; al resto los envía a `/login`. */
export function AuthGuard({ children }: AuthGuardProps): ReactNode {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50" role="status">
        <span className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-emerald-500" />
        <p className="text-sm text-slate-500">Cargando sesión...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return children;
}
