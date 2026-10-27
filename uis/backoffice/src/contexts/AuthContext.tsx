'use client';

import { useRouter } from 'next/navigation';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

import { API_BASE_URL, clearToken, fetchWithAuth, getToken, setToken as storeToken } from '../utils/api';

export type UserRole = 'admin' | 'manager' | 'user';

export type AuthUser = {
  email: string;
  role: UserRole;
  name: string;
  phone: string;
  address: string;
};

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
};

type LoginResponse = {
  access_token: string;
  token_type: string;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function fetchCurrentUser(): Promise<AuthUser | null> {
  let response: Response;
  try {
    response = await fetchWithAuth('/auth/me');
  } catch {
    return null;
  }
  if (!response.ok) {
    return null;
  }
  try {
    const data = (await response.json()) as Partial<AuthUser> | null;
    if (!data || typeof data.email !== 'string') {
      return null;
    }
    return {
      email: data.email,
      role: data.role ?? 'user',
      name: data.name ?? '',
      phone: data.phone ?? '',
      address: data.address ?? '',
    };
  } catch {
    return null;
  }
}

type AuthProviderProps = {
  children: ReactNode;
};

/** Mantiene la sesión del usuario y expone las operaciones de login y logout. */
export function AuthProvider({ children }: AuthProviderProps): ReactNode {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = getToken();
    if (storedToken === null) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setToken(storedToken);
    fetchCurrentUser()
      .then((currentUser) => {
        if (cancelled) return;
        setUser(currentUser);
        if (currentUser === null) setToken(null);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<void> => {
    // A failed login returns 401, so it must not go through fetchWithAuth's redirect.
    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ username: email, password }),
      });
    } catch {
      throw new Error('No se pudo conectar con la API. Comprueba que el servidor está en marcha.');
    }

    if (!response.ok) {
      throw new Error(
        response.status === 401
          ? 'Email o contraseña incorrectos.'
          : 'No pudimos iniciar tu sesión en este momento. Por favor, inténtalo de nuevo en unos segundos.',
      );
    }

    let data: Partial<LoginResponse> | null = null;
    try {
      data = (await response.json()) as Partial<LoginResponse>;
    } catch {
      throw new Error('La respuesta del servidor no pudo procesarse. Inténtalo de nuevo.');
    }

    const accessToken = data?.access_token ?? '';
    if (!accessToken) {
      throw new Error('No se recibió un token de sesión válido. Inténtalo de nuevo.');
    }

    storeToken(accessToken);
    setToken(accessToken);
    setUser(await fetchCurrentUser());
  }, []);

  const logout = useCallback((): void => {
    clearToken();
    setToken(null);
    setUser(null);
    router.replace('/login');
  }, [router]);

  const refreshUser = useCallback(async (): Promise<void> => {
    try {
      const currentUser = await fetchCurrentUser();
      setUser(currentUser);
    } catch {
      // Keep existing user state if background refresh fails.
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ token, user, isAuthenticated: token !== null && user !== null, isLoading, login, logout, refreshUser }),
    [token, user, isLoading, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/** Devuelve el estado de autenticación; debe usarse dentro de `AuthProvider`. */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === null) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider.');
  }
  return context;
}
