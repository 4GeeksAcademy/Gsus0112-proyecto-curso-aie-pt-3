import {
  clearToken,
  fetchWithAuth,
  getToken,
  resolveApiBaseUrl,
  setToken,
} from '../src/utils/api';

describe('Utilidades de autenticación y sesión (src/utils/api.ts)', () => {
  const originalEnv = process.env.NEXT_PUBLIC_API_URL;
  const originalWindow = globalThis.window;
  const originalFetch = globalThis.fetch;

  let store: Record<string, string> = {};

  beforeEach(() => {
    store = {};
    delete process.env.NEXT_PUBLIC_API_URL;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {
        location: {
          protocol: 'http:',
          hostname: 'localhost',
          pathname: '/incidents',
          href: 'http://localhost:3000/incidents',
        },
        localStorage: {
          getItem: jest.fn((key: string) => (key in store ? store[key] : null)),
          setItem: jest.fn((key: string, value: string) => {
            store[key] = value;
          }),
          removeItem: jest.fn((key: string) => {
            delete store[key];
          }),
        },
      },
    });
  });

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.NEXT_PUBLIC_API_URL;
    } else {
      process.env.NEXT_PUBLIC_API_URL = originalEnv;
    }
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: originalWindow,
    });
    globalThis.fetch = originalFetch;
  });

  // =====================================================================
  // 1. CAMINO FELIZ (Happy Path)
  // =====================================================================

  test('setToken, getToken y clearToken gestionan el ciclo de vida del JWT en localStorage', () => {
    expect(getToken()).toBeNull();

    setToken('jwt-token-valido-123');
    expect(getToken()).toBe('jwt-token-valido-123');

    clearToken();
    expect(getToken()).toBeNull();
  });

  test('fetchWithAuth adjunta automáticamente la cabecera Authorization Bearer cuando existe token', async () => {
    setToken('mi-jwt-activo');
    const mockFetch = jest.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    globalThis.fetch = mockFetch;

    const response = await fetchWithAuth('/auth/me', {
      headers: { 'X-Custom': 'valor' },
    });

    expect(response.status).toBe(200);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [, requestInit] = mockFetch.mock.calls[0] as [string, RequestInit];
    const headers = requestInit.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer mi-jwt-activo');
    expect(headers.get('X-Custom')).toBe('valor');
  });

  test('resolveApiBaseUrl usa NEXT_PUBLIC_API_URL sin barra final o localhost por defecto', () => {
    expect(resolveApiBaseUrl()).toBe('http://localhost:8000');

    process.env.NEXT_PUBLIC_API_URL = 'https://api.trackflow.com/';
    expect(resolveApiBaseUrl()).toBe('https://api.trackflow.com');
  });

  // =====================================================================
  // 2. CASOS LÍMITE (Edge Cases)
  // =====================================================================

  test('resolveApiBaseUrl transforma correctamente el dominio de GitHub Codespaces al puerto 8000', () => {
    window.location.protocol = 'https:';
    window.location.hostname = 'psychic-space-orbit-3000.app.github.dev';

    expect(resolveApiBaseUrl()).toBe('https://psychic-space-orbit-8000.app.github.dev');
  });

  test('getToken, setToken y clearToken operan de forma segura en entorno SSR (window undefined)', () => {
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(getToken()).toBeNull();
    expect(() => setToken('ssr-token')).not.toThrow();
    expect(() => clearToken()).not.toThrow();
  });

  test('fetchWithAuth en /login limpia el token ante un 401 pero evita bucle de redirección', async () => {
    setToken('token-expirado');
    window.location.pathname = '/login';
    window.location.href = 'http://localhost:3000/login';
    globalThis.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 401 }));

    const response = await fetchWithAuth('/auth/me');

    expect(response.status).toBe(401);
    expect(getToken()).toBeNull();
    expect(window.location.href).toBe('http://localhost:3000/login');
  });

  // =====================================================================
  // 3. MODOS DE FALLO (Failure Modes)
  // =====================================================================

  test('fetchWithAuth ante un 401 fuera de /login limpia el token y redirige a /login', async () => {
    setToken('token-expirado');
    window.location.pathname = '/suppliers';
    globalThis.fetch = jest.fn().mockResolvedValue(new Response(null, { status: 401 }));

    await fetchWithAuth('/api/suppliers');

    expect(getToken()).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  test('fetchWithAuth traduce fallos de red en un error legible y propaga AbortError intacto', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    await expect(fetchWithAuth('/auth/me')).rejects.toThrow(
      'No se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.',
    );

    const abortErr = new DOMException('Aborted', 'AbortError');
    globalThis.fetch = jest.fn().mockRejectedValue(abortErr);
    await expect(fetchWithAuth('/auth/me')).rejects.toBe(abortErr);
  });

  test('getToken, setToken y clearToken absorben excepciones de acceso a localStorage', () => {
    window.localStorage.getItem = jest.fn(() => {
      throw new Error('SecurityError');
    });
    window.localStorage.setItem = jest.fn(() => {
      throw new Error('QuotaExceededError');
    });
    window.localStorage.removeItem = jest.fn(() => {
      throw new Error('SecurityError');
    });

    expect(getToken()).toBeNull();
    expect(() => setToken('token')).not.toThrow();
    expect(() => clearToken()).not.toThrow();
  });
});
