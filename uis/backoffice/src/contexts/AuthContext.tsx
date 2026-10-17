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
  const response = await fetchWithAuth('/auth/me');
  if (!response.ok) {
    return null;
  }
  return (await response.json()) as AuthUser;
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
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: email, password }),
    });
    if (!response.ok) {
      throw new Error(response.status === 401 ? 'Email o contraseña incorrectos.' : `Error al iniciar sesión (HTTP ${response.status}).`);
    }

    const { access_token: accessToken } = (await response.json()) as LoginResponse;
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
    setUser(await fetchCurrentUser());
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
