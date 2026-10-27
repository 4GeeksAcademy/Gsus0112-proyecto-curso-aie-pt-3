import {
  CandidateCreateInput,
  CandidateNote,
  CandidatePatchInput,
  CandidateRecord,
  CandidateStage,
  CandidateStatus,
  NoteCreateInput,
} from '../types/candidate';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

type RecordQueryParams = {
  status?: CandidateStatus;
  stage?: CandidateStage;
  search?: string;
  page?: number;
  limit?: number;
};

const JSON_HEADERS: HeadersInit = {
  'Content-Type': 'application/json',
};

type ApiWrappedList<T> = {
  data: T[];
};

type ApiWrappedItem<T> = {
  data: T;
};

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractList<T>(payload: unknown, context: string): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (isObjectRecord(payload) && Array.isArray(payload.data)) {
    return payload.data as T[];
  }

  throw new Error(`${context}: formato de respuesta inesperado.`);
}

function extractItem<T>(payload: unknown, context: string): T {
  if (isObjectRecord(payload) && 'data' in payload && isObjectRecord(payload.data)) {
    return payload.data as T;
  }

  if (isObjectRecord(payload)) {
    return payload as T;
  }

  throw new Error(`${context}: formato de respuesta inesperado.`);
}

function buildUrl(path: string, params?: RecordQueryParams): string {
  if (!API_BASE_URL) {
    throw new Error('El servicio de candidaturas no está disponible en este momento. Contacta con soporte técnico.');
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  let url: URL;
  try {
    url = new URL(normalizedPath, baseUrl);
  } catch {
    throw new Error('La dirección del servicio de candidaturas no es válida. Contacta con soporte técnico.');
  }

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function executeFetch(url: string, init: RequestInit, context: string): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(`${context}: no se pudo conectar con el servidor. Comprueba tu conexión e inténtalo de nuevo.`);
  }
}

async function handleResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`${context}: el registro solicitado ya no existe o no fue encontrado.`);
    }
    if (response.status === 400 || response.status === 422) {
      throw new Error(`${context}: revisa los datos ingresados, algunos campos no son válidos.`);
    }
    throw new Error(`${context}: el servidor no pudo procesar la solicitud en este momento. Inténtalo de nuevo.`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new Error(`${context}: la respuesta del servidor no pudo interpretarse correctamente.`);
  }
}

export async function getRecords(params?: RecordQueryParams): Promise<CandidateRecord[]> {
  const response = await executeFetch(
    buildUrl('records', params),
    {
      method: 'GET',
      headers: JSON_HEADERS,
    },
    'No se pudieron obtener las candidaturas',
  );

  const payload = await handleResponse<unknown>(response, 'No se pudieron obtener las candidaturas');
  return extractList<CandidateRecord>(payload, 'No se pudieron obtener las candidaturas');
}

export async function getRecordById(id: string): Promise<CandidateRecord> {
  const response = await executeFetch(
    buildUrl(`records/${id}`),
    {
      method: 'GET',
      headers: JSON_HEADERS,
    },
    'No se pudo obtener el detalle de la candidatura',
  );

  const payload = await handleResponse<unknown>(response, 'No se pudo obtener el detalle de la candidatura');
  return extractItem<CandidateRecord>(payload, 'No se pudo obtener el detalle de la candidatura');
}

export async function createRecord(data: CandidateCreateInput): Promise<CandidateRecord> {
  const response = await executeFetch(
    buildUrl('records'),
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    },
    'No se pudo registrar la candidatura',
  );

  const payload = await handleResponse<unknown>(response, 'No se pudo registrar la candidatura');
  return extractItem<CandidateRecord>(payload, 'No se pudo registrar la candidatura');
}

export async function updateRecord(id: string, data: CandidateCreateInput): Promise<CandidateRecord> {
  const response = await executeFetch(
    buildUrl(`records/${id}`),
    {
      method: 'PUT',
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    },
    'No se pudo actualizar la candidatura',
  );

  const payload = await handleResponse<unknown>(response, 'No se pudo actualizar la candidatura');
  return extractItem<CandidateRecord>(payload, 'No se pudo actualizar la candidatura');
}

export async function patchRecord(id: string, data: CandidatePatchInput): Promise<CandidateRecord> {
  const response = await executeFetch(
    buildUrl(`records/${id}`),
    {
      method: 'PATCH',
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    },
    'No se pudo modificar el estado de la candidatura',
  );

  const payload = await handleResponse<unknown>(response, 'No se pudo modificar el estado de la candidatura');
  return extractItem<CandidateRecord>(payload, 'No se pudo modificar el estado de la candidatura');
}

export async function deleteRecord(id: string): Promise<void> {
  const response = await executeFetch(
    buildUrl(`records/${id}`),
    {
      method: 'DELETE',
      headers: JSON_HEADERS,
    },
    'No se pudo eliminar la candidatura',
  );

  await handleResponse<void>(response, 'No se pudo eliminar la candidatura');
}

export async function getNotes(recordId: string): Promise<CandidateNote[]> {
  const response = await executeFetch(
    buildUrl(`records/${recordId}/notes`),
    {
      method: 'GET',
      headers: JSON_HEADERS,
    },
    'No se pudieron cargar las notas',
  );

  const payload = await handleResponse<unknown>(response, 'No se pudieron cargar las notas');
  return extractList<CandidateNote>(payload, 'No se pudieron cargar las notas');
}

export async function addNote(recordId: string, data: NoteCreateInput): Promise<CandidateNote> {
  const response = await executeFetch(
    buildUrl(`records/${recordId}/notes`),
    {
      method: 'POST',
      headers: JSON_HEADERS,
      body: JSON.stringify(data),
    },
    'No se pudo guardar la nota',
  );

  const payload = await handleResponse<unknown>(response, 'No se pudo guardar la nota');
  return extractItem<CandidateNote>(payload, 'No se pudo guardar la nota');
}

export async function deleteNote(recordId: string, noteId: string): Promise<void> {
  const response = await executeFetch(
    buildUrl(`records/${recordId}/notes/${noteId}`),
    {
      method: 'DELETE',
      headers: JSON_HEADERS,
    },
    'No se pudo eliminar la nota',
  );

  await handleResponse<void>(response, 'No se pudo eliminar la nota');
}
