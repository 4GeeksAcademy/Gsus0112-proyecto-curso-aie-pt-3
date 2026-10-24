const TOKEN_STORAGE_KEY = 'trackflow_token';
const LOGIN_PATH = '/login';

/** Resuelve la URL de la API: variable de entorno, puerto 8000 del Codespace o localhost. */
function resolveApiBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_API_URL;
  if (configured) {
    return configured.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.app.github.dev')) {
    const host = window.location.hostname.replace(/-\d+(?=\.app\.github\.dev$)/, '-8000');
    return `${window.location.protocol}//${host}`;
  }
  return 'http://localhost:8000';
}

export const API_BASE_URL = resolveApiBaseUrl();

export function getToken(): string | null {
  if (typeof window === 'undefined') {
    return null;
  }
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string): void {
  window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
}

export function clearToken(): void {
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

/** Ejecuta `fetch` contra la API añadiendo el token JWT y gestionando la expiración de sesión. */
export async function fetchWithAuth(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();
  if (token !== null) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...init, headers });

  if (response.status === 401) {
    clearToken();
    // Avoids a reload loop if the login page itself triggers a 401.
    if (window.location.pathname !== LOGIN_PATH) {
      window.location.href = LOGIN_PATH;
    }
  }
  return response;
}
