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
    throw new Error('NEXT_PUBLIC_API_URL no está definida en las variables de entorno.');
  }

  const normalizedPath = path.startsWith('/') ? path.slice(1) : path;
  const baseUrl = API_BASE_URL.endsWith('/') ? API_BASE_URL : `${API_BASE_URL}/`;
  const url = new URL(normalizedPath, baseUrl);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url.toString();
}

async function handleResponse<T>(response: Response, context: string): Promise<T> {
  if (!response.ok) {
    throw new Error(`${context}: ${response.status} ${response.statusText}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export async function getRecords(params?: RecordQueryParams): Promise<CandidateRecord[]> {
  const response = await fetch(buildUrl('records', params), {
    method: 'GET',
    headers: JSON_HEADERS,
  });

  const payload = await handleResponse<unknown>(response, 'Error al obtener candidatos');
  return extractList<CandidateRecord>(payload, 'Error al obtener candidatos');
}

export async function getRecordById(id: string): Promise<CandidateRecord> {
  const response = await fetch(buildUrl(`records/${id}`), {
    method: 'GET',
    headers: JSON_HEADERS,
  });

  const payload = await handleResponse<unknown>(response, `Error al obtener candidato ${id}`);
  return extractItem<CandidateRecord>(payload, `Error al obtener candidato ${id}`);
}

export async function createRecord(data: CandidateCreateInput): Promise<CandidateRecord> {
  const response = await fetch(buildUrl('records'), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  const payload = await handleResponse<unknown>(response, 'Error al crear candidato');
  return extractItem<CandidateRecord>(payload, 'Error al crear candidato');
}

export async function updateRecord(id: string, data: CandidateCreateInput): Promise<CandidateRecord> {
  const response = await fetch(buildUrl(`records/${id}`), {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  const payload = await handleResponse<unknown>(response, `Error al actualizar candidato ${id}`);
  return extractItem<CandidateRecord>(payload, `Error al actualizar candidato ${id}`);
}

export async function patchRecord(id: string, data: CandidatePatchInput): Promise<CandidateRecord> {
  const response = await fetch(buildUrl(`records/${id}`), {
    method: 'PATCH',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  const payload = await handleResponse<unknown>(response, `Error al modificar candidato ${id}`);
  return extractItem<CandidateRecord>(payload, `Error al modificar candidato ${id}`);
}

export async function deleteRecord(id: string): Promise<void> {
  const response = await fetch(buildUrl(`records/${id}`), {
    method: 'DELETE',
    headers: JSON_HEADERS,
  });

  await handleResponse<void>(response, `Error al eliminar candidato ${id}`);
}

export async function getNotes(recordId: string): Promise<CandidateNote[]> {
  const response = await fetch(buildUrl(`records/${recordId}/notes`), {
    method: 'GET',
    headers: JSON_HEADERS,
  });

  const payload = await handleResponse<unknown>(response, `Error al obtener notas del candidato ${recordId}`);
  return extractList<CandidateNote>(payload, `Error al obtener notas del candidato ${recordId}`);
}

export async function addNote(recordId: string, data: NoteCreateInput): Promise<CandidateNote> {
  const response = await fetch(buildUrl(`records/${recordId}/notes`), {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(data),
  });

  const payload = await handleResponse<unknown>(response, `Error al crear nota del candidato ${recordId}`);
  return extractItem<CandidateNote>(payload, `Error al crear nota del candidato ${recordId}`);
}

export async function deleteNote(recordId: string, noteId: string): Promise<void> {
  const response = await fetch(buildUrl(`records/${recordId}/notes/${noteId}`), {
    method: 'DELETE',
    headers: JSON_HEADERS,
  });

  await handleResponse<void>(response, `Error al eliminar nota ${noteId} del candidato ${recordId}`);
}
