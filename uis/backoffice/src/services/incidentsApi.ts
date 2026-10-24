import type {
  Incident,
  IncidentCreateInput,
  IncidentFilters,
  IncidentStatus,
  IncidentSummary,
} from '../types/incidents';
import { API_BASE_URL, getToken } from '../utils/api';

/** Obtiene la URL base de la API de incidencias configurada o local por defecto. */
export function getApiBaseUrl(): string {
  return API_BASE_URL;
}

function buildAuthHeaders(extra?: Record<string, string>): HeadersInit {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...extra,
  };
  const token = getToken();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}

export class ApiValidationError extends Error {
  public readonly status: number;
  public readonly field: string | null;

  constructor(message: string, status: number, field: string | null = null) {
    super(message);
    this.name = 'ApiValidationError';
    this.status = status;
    this.field = field;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractFriendlyError(payload: unknown, status: number): { message: string; field: string | null } {
  if (isRecord(payload)) {
    const rawField = typeof payload.field === 'string' ? payload.field : null;
    const rawMsg =
      typeof payload.message === 'string'
        ? payload.message
        : typeof payload.error === 'string'
          ? payload.error
          : typeof payload.detail === 'string'
            ? payload.detail
            : null;

    if (rawMsg && rawMsg.trim().length > 0 && status < 500) {
      return { message: rawMsg.trim(), field: rawField };
    }
  }

  if (status === 404) {
    return { message: 'La incidencia solicitada ya no existe o no fue encontrada.', field: null };
  }
  if (status === 400 || status === 422) {
    return {
      message: 'Algunos de los datos ingresados no son válidos. Revisa los campos e inténtalo de nuevo.',
      field: null,
    };
  }
  return {
    message: 'El servidor no pudo procesar la solicitud en este momento. Por favor, inténtalo de nuevo en unos segundos.',
    field: null,
  };
}

/** Obtiene la lista de incidencias con filtros opcionales por status, origin, branch y category. */
export async function fetchIncidents(filters?: IncidentFilters): Promise<Incident[]> {
  const baseUrl = getApiBaseUrl();
  const params = new URLSearchParams();

  if (filters) {
    if (filters.status) params.set('status', filters.status);
    if (filters.origin) params.set('origin', filters.origin);
    if (filters.branch) params.set('branch', filters.branch);
    if (filters.category) params.set('category', filters.category);
  }

  const queryString = params.toString();
  const url = `${baseUrl}/api/incidents${queryString ? `?${queryString}` : ''}`;

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: buildAuthHeaders(),
      cache: 'no-store',
    });
  } catch {
    throw new ApiValidationError(
      'No se pudo conectar con el servidor de incidencias. Verifica que la API esté activa e inténtalo de nuevo.',
      0,
    );
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const { message, field } = extractFriendlyError(payload, response.status);
    throw new ApiValidationError(message, response.status, field);
  }

  const data: unknown = await response.json();
  if (Array.isArray(data)) {
    return data as Incident[];
  }
  return [];
}

/** Obtiene el detalle de una incidencia por su ID. */
export async function fetchIncidentById(id: number): Promise<Incident> {
  const baseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/incidents/${id}`, {
      method: 'GET',
      headers: buildAuthHeaders(),
      cache: 'no-store',
    });
  } catch {
    throw new ApiValidationError(
      'No se pudo conectar con el servidor para consultar el detalle de la incidencia.',
      0,
    );
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const { message, field } = extractFriendlyError(payload, response.status);
    throw new ApiValidationError(message, response.status, field);
  }

  return (await response.json()) as Incident;
}

/** Crea una nueva incidencia mediante POST /api/incidents. */
export async function createIncidentRequest(input: IncidentCreateInput): Promise<Incident> {
  const baseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/incidents`, {
      method: 'POST',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(input),
    });
  } catch {
    throw new ApiValidationError(
      'No fue posible enviar la incidencia porque no hay conexión con el servidor. Inténtalo nuevamente.',
      0,
    );
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const { message, field } = extractFriendlyError(payload, response.status);
    throw new ApiValidationError(message, response.status, field);
  }

  return (await response.json()) as Incident;
}

/** Actualiza el estado de una incidencia mediante PATCH /api/incidents/{id}/status. */
export async function updateIncidentStatusRequest(
  id: number,
  status: IncidentStatus,
): Promise<Incident> {
  const baseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/incidents/${id}/status`, {
      method: 'PATCH',
      headers: buildAuthHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify({ status }),
    });
  } catch {
    throw new ApiValidationError(
      'No se pudo actualizar el estado por un problema de conexión con el servidor.',
      0,
    );
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const { message, field } = extractFriendlyError(payload, response.status);
    throw new ApiValidationError(message, response.status, field);
  }

  return (await response.json()) as Incident;
}

/** Obtiene las métricas agregadas desde GET /api/incidents/summary. */
export async function fetchIncidentsSummary(): Promise<IncidentSummary> {
  const baseUrl = getApiBaseUrl();
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/incidents/summary`, {
      method: 'GET',
      headers: buildAuthHeaders(),
      cache: 'no-store',
    });
  } catch {
    throw new ApiValidationError(
      'No se pudieron cargar las métricas del resumen porque el servidor no está disponible.',
      0,
    );
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    const { message, field } = extractFriendlyError(payload, response.status);
    throw new ApiValidationError(message, response.status, field);
  }

  return (await response.json()) as IncidentSummary;
}
