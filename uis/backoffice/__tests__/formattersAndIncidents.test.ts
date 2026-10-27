import {
  ApiValidationError,
  buildAuthHeaders,
  createIncidentRequest,
  extractFriendlyError,
  fetchIncidentById,
  fetchIncidents,
  fetchIncidentsSummary,
  updateIncidentStatusRequest,
} from '../src/services/incidentsApi';
import { setToken } from '../src/utils/api';
import { formatDate, getStatusBadgeClasses } from '../src/utils/formatters';

describe('Formateadores y servicio de incidencias del frontend (Ticket FE-019)', () => {
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;

  beforeEach(() => {
    const store: Record<string, string> = {};
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: {
        location: { protocol: 'http:', hostname: 'localhost', pathname: '/' },
        localStorage: {
          getItem: (k: string) => (k in store ? store[k] : null),
          setItem: (k: string, v: string) => {
            store[k] = v;
          },
          removeItem: (k: string) => {
            delete store[k];
          },
        },
      },
    });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      writable: true,
      value: originalWindow,
    });
  });

  // =====================================================================
  // 1. CAMINO FELIZ (Happy Path)
  // =====================================================================

  test('formatDate formatea fechas ISO válidas y getStatusBadgeClasses asigna estilos por estado', () => {
    const formatted = formatDate('2026-10-20T12:00:00Z');
    expect(formatted).toContain('2026');

    expect(getStatusBadgeClasses('open')).toContain('amber');
    expect(getStatusBadgeClasses('in_progress')).toContain('sky');
    expect(getStatusBadgeClasses('resolved')).toContain('emerald');
    expect(getStatusBadgeClasses('discarded')).toContain('slate');
  });

  test('buildAuthHeaders incluye el token Bearer y cabeceras adicionales', () => {
    setToken('token-operador');
    const headers = buildAuthHeaders({ 'Content-Type': 'application/json' }) as Record<string, string>;

    expect(headers.Authorization).toBe('Bearer token-operador');
    expect(headers['Content-Type']).toBe('application/json');
  });

  test('fetchIncidents, fetchIncidentById, createIncidentRequest, updateIncidentStatusRequest y fetchIncidentsSummary procesan respuestas exitosas', async () => {
    const sampleIncident = {
      id: 1,
      title: 'Incidencia ruta sur',
      description: 'Retraso en entrega por incidencia de transportista',
      category: 'carrier_issue' as const,
      status: 'open' as const,
      origin: 'branch' as const,
      branch: 'zaragoza_warehouse' as const,
      created_at: '2026-10-20T10:00:00Z',
      updated_at: '2026-10-20T10:00:00Z',
    };

    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify([sampleIncident]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleIncident), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(sampleIncident), { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...sampleIncident, status: 'in_progress' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ total: 1, by_status: { open: 1 } }), { status: 200 }),
      );

    const list = await fetchIncidents({
      status: 'open',
      branch: 'zaragoza_warehouse',
      origin: 'branch',
      category: 'carrier_issue',
    });
    expect(list).toHaveLength(1);

    const detail = await fetchIncidentById(1);
    expect(detail.id).toBe(1);

    const created = await createIncidentRequest({
      title: sampleIncident.title,
      description: sampleIncident.description,
      category: 'carrier_issue',
      origin: 'branch',
      branch: 'zaragoza_warehouse',
    });
    expect(created.title).toBe('Incidencia ruta sur');

    const updated = await updateIncidentStatusRequest(1, 'in_progress');
    expect(updated.status).toBe('in_progress');

    const summary = await fetchIncidentsSummary();
    expect(summary.total).toBe(1);
  });

  // =====================================================================
  // 2. CASOS LÍMITE (Edge Cases)
  // =====================================================================

  test('formatDate devuelve guion para cadena vacía y conserva el texto si la fecha es inválida', () => {
    expect(formatDate('')).toBe('—');
    expect(formatDate('no-es-una-fecha')).toBe('no-es-una-fecha');
  });

  test('extractFriendlyError extrae message, error o detail en códigos 4xx y usa fallback en 5xx', () => {
    expect(extractFriendlyError({ message: '  Campo requerido  ', field: 'title' }, 400)).toEqual({
      message: 'Campo requerido',
      field: 'title',
    });
    expect(extractFriendlyError({ detail: 'Transición inválida' }, 422)).toEqual({
      message: 'Transición inválida',
      field: null,
    });
    expect(extractFriendlyError({ message: 'Error SQL interno' }, 500).message).toContain(
      'El servidor no pudo procesar',
    );
  });

  // =====================================================================
  // 3. MODOS DE FALLO (Failure Modes)
  // =====================================================================

  test('los métodos de incidentsApi lanzan ApiValidationError ante errores HTTP o fallos de red', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('Network down'));
    await expect(fetchIncidents()).rejects.toBeInstanceOf(ApiValidationError);
    await expect(fetchIncidentById(99)).rejects.toBeInstanceOf(ApiValidationError);
    await expect(
      createIncidentRequest({
        title: 'T',
        description: 'D',
        category: 'carrier_issue',
        origin: 'branch',
        branch: 'central',
      }),
    ).rejects.toBeInstanceOf(ApiValidationError);
    await expect(updateIncidentStatusRequest(1, 'resolved')).rejects.toBeInstanceOf(
      ApiValidationError,
    );
    await expect(fetchIncidentsSummary()).rejects.toBeInstanceOf(ApiValidationError);

    globalThis.fetch = jest.fn().mockResolvedValue(
      new Response(JSON.stringify({ detail: 'No encontrado' }), { status: 404 }),
    );
    await expect(fetchIncidentById(404)).rejects.toMatchObject({
      status: 404,
      message: 'No encontrado',
    });
  });
});
