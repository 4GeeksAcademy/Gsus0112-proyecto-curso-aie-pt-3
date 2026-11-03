import { clearToken, getToken } from '../utils/api';

const LOGIN_PATH = '/login';

export type WarehouseCode = 'LA' | 'ZGZ';
export type SKUCategory = 'fashion' | 'electronics' | 'cosmetics';
export type ExitType = 'dispatch' | 'loss';
export type OrderMovementType = 'inbound' | 'outbound';
export type StockLevelStatus = 'critical' | 'low' | 'healthy';

export interface SKUItem {
  id: number;
  name: string;
  sku: string;
  client_name: string;
  category: SKUCategory;
  warehouse: WarehouseCode;
  current_stock: number;
  stock_by_warehouse?: Record<string, number>;
}

export interface SKUCreatePayload {
  name: string;
  sku: string;
  client_name: string;
  category: SKUCategory;
  warehouse: WarehouseCode;
}

export interface StockEntryCreatePayload {
  sku_id: number;
  quantity: number;
  reference: string;
  warehouse: WarehouseCode;
}

export interface StockEntryItem {
  id: number;
  sku_id: number;
  quantity: number;
  reference: string;
  warehouse: WarehouseCode;
  created_at: string;
  user_uuid: string;
}

export interface StockExitCreatePayload {
  sku_id: number;
  quantity: number;
  exit_type: ExitType;
  tracking_number: string | null;
  warehouse: WarehouseCode;
}

export interface StockExitItem {
  id: number;
  sku_id: number;
  quantity: number;
  exit_type: ExitType;
  tracking_number: string | null;
  warehouse: WarehouseCode;
  created_at: string;
  user_uuid: string;
}

export interface SKUSummary {
  id: number;
  name: string;
  sku: string;
  client_name: string;
  category: SKUCategory;
  warehouse: WarehouseCode;
}

export interface StockOrderItem {
  id: number;
  order_type: OrderMovementType;
  sku_id: number;
  sku: SKUSummary;
  quantity: number;
  warehouse: WarehouseCode;
  reference: string | null;
  exit_type: ExitType | null;
  tracking_number: string | null;
  created_at: string;
  user_uuid: string;
}

export const WAREHOUSE_LABELS: Record<WarehouseCode, string> = {
  LA: 'LA — Los Ángeles (EE. UU.)',
  ZGZ: 'ZGZ — Zaragoza (España)',
};

export const CATEGORY_LABELS: Record<SKUCategory, string> = {
  fashion: 'Moda (fashion)',
  electronics: 'Electrónica (electronics)',
  cosmetics: 'Cosmética (cosmetics)',
};

export const EXIT_TYPE_LABELS: Record<ExitType, string> = {
  dispatch: 'Despacho a cliente (dispatch)',
  loss: 'Pérdida / Daño confirmado (loss)',
};

/**
 * Umbrales documentados de nivel de stock para operaciones de almacén en TrackFlow (LA y ZGZ):
 * - `critical` (<= 10 uds.): nivel crítico o rotura inminente; requiere reposición prioritaria con la marca cliente.
 * - `low` (11 a 50 uds.): stock bajo de seguridad; alerta preventiva para coordinar nueva recepción (`StockEntry`).
 * - `healthy` (> 50 uds.): stock saludable; cobertura operativa normal para preparación y despacho (`StockExit`).
 */
export const CRITICAL_STOCK_THRESHOLD = 10;
export const LOW_STOCK_THRESHOLD = 50;

export function classifyStockLevel(currentStock: number): {
  status: StockLevelStatus;
  label: string;
  icon: string;
} {
  if (currentStock <= CRITICAL_STOCK_THRESHOLD) {
    return {
      status: 'critical',
      label: currentStock <= 0 ? 'Sin stock (0)' : 'Stock crítico',
      icon: '🔴',
    };
  }
  if (currentStock <= LOW_STOCK_THRESHOLD) {
    return {
      status: 'low',
      label: 'Stock bajo',
      icon: '🟡',
    };
  }
  return {
    status: 'healthy',
    label: 'Stock saludable',
    icon: '🟢',
  };
}

/** Obtiene el stock disponible de un SKU para un almacén concreto (Regla 6 de TrackFlow: stock por almacén). */
export function getAvailableStockForWarehouse(
  product: SKUItem | null,
  warehouse: WarehouseCode,
): number {
  if (!product) {
    return 0;
  }
  if (product.stock_by_warehouse && typeof product.stock_by_warehouse[warehouse] === 'number') {
    return product.stock_by_warehouse[warehouse];
  }
  return product.warehouse === warehouse ? product.current_stock : 0;
}

/** Resuelve la URL base de la API de inventario (`NEXT_PUBLIC_INVENTORY_API_URL`, `NEXT_PUBLIC_API_URL`, Codespace o localhost:8000). */
export function resolveInventoryApiBaseUrl(): string {
  const configuredInventoryUrl = process.env.NEXT_PUBLIC_INVENTORY_API_URL;
  if (configuredInventoryUrl && configuredInventoryUrl.trim().length > 0) {
    return configuredInventoryUrl.trim().replace(/\/$/, '');
  }
  const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (configuredApiUrl && configuredApiUrl.trim().length > 0) {
    return configuredApiUrl.trim().replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.app.github.dev')) {
    const host = window.location.hostname.replace(/-\d+(?=\.app\.github\.dev$)/, '-8000');
    return `${window.location.protocol}//${host}`;
  }
  return 'http://localhost:8000';
}

export class InventoryApiError extends Error {
  public readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'InventoryApiError';
    this.status = status;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Extrae un mensaje legible de respuestas 4xx/5xx de FastAPI sin exponer JSON crudo ni códigos HTTP desnudos. */
export function extractInventoryApiError(payload: unknown, status: number): string {
  if (isRecord(payload)) {
    if (typeof payload.detail === 'string' && payload.detail.trim().length > 0) {
      return payload.detail.trim();
    }
    if (Array.isArray(payload.detail) && payload.detail.length > 0) {
      const messages = payload.detail
        .map((item) => {
          if (!isRecord(item)) return null;
          const loc = Array.isArray(item.loc)
            ? item.loc
                .filter((part) => part !== 'body' && part !== 'query' && part !== 'path')
                .map(String)
                .join('.')
            : '';
          const rawMsg = typeof item.msg === 'string' ? item.msg.replace(/^Value error,\s*/i, '').trim() : 'valor inválido';
          return loc ? `${loc}: ${rawMsg}` : rawMsg;
        })
        .filter((entry): entry is string => Boolean(entry));

      if (messages.length > 0) {
        return `Revisa los datos del formulario: ${messages.join('; ')}`;
      }
    }
    if (typeof payload.message === 'string' && payload.message.trim().length > 0) {
      return payload.message.trim();
    }
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error.trim();
    }
  }

  if (status === 401) {
    return 'Tu sesión ha expirado o no es válida. Inicia sesión nuevamente.';
  }
  if (status === 404) {
    return 'El SKU o recurso de inventario solicitado no existe.';
  }
  if (status === 409) {
    return 'Ya existe un SKU con ese código registrado en el almacén seleccionado.';
  }
  if (status === 400 || status === 422) {
    return 'Los datos enviados no cumplen las reglas de validación de inventario. Revisa los campos.';
  }
  return 'El servidor de inventario no pudo procesar la operación en este momento. Inténtalo de nuevo.';
}

async function inventoryRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const baseUrl = resolveInventoryApiBaseUrl();
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');

  const token = getToken();
  if (token !== null && token.trim().length > 0) {
    headers.set('Authorization', `Bearer ${token}`);
  }
  if (init.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      cache: 'no-store',
    });
  } catch (error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw error;
    }
    throw new InventoryApiError(
      'No se pudo conectar con la API de inventario. Verifica que el backend esté ejecutándose e inténtalo de nuevo.',
      0,
    );
  }

  if (response.status === 401) {
    clearToken();
    if (typeof window !== 'undefined' && window.location.pathname !== LOGIN_PATH) {
      window.location.href = LOGIN_PATH;
    }
    throw new InventoryApiError(
      'Tu sesión ha expirado. Redirigiendo a la página de inicio de sesión...',
      401,
    );
  }

  if (!response.ok) {
    let payload: unknown = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new InventoryApiError(extractInventoryApiError(payload, response.status), response.status);
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new InventoryApiError(
      'La respuesta del servidor de inventario no tiene un formato JSON válido.',
      response.status,
    );
  }
}

/** `GET /inventory/products` — Obtiene el catálogo completo de SKUs con su `current_stock` calculado. */
export async function fetchInventoryProducts(
  warehouse?: WarehouseCode,
  signal?: AbortSignal,
): Promise<SKUItem[]> {
  const query = warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : '';
  const data = await inventoryRequest<unknown>(`/inventory/products${query}`, {
    method: 'GET',
    signal,
  });
  return Array.isArray(data) ? (data as SKUItem[]) : [];
}

/** `GET /inventory/products/{id}` — Obtiene el detalle actualizado y `current_stock` de un SKU concreto. */
export async function fetchInventoryProductById(
  id: number,
  signal?: AbortSignal,
): Promise<SKUItem> {
  return inventoryRequest<SKUItem>(`/inventory/products/${id}`, {
    method: 'GET',
    signal,
  });
}

/** `POST /inventory/products` — Registra un nuevo SKU en el catálogo de TrackFlow (requiere JWT). */
export async function createInventoryProduct(payload: SKUCreatePayload): Promise<SKUItem> {
  return inventoryRequest<SKUItem>('/inventory/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** `POST /inventory/orders/inbound` — Registra una recepción de mercancía (`StockEntry`, requiere JWT). */
export async function createInboundOrder(
  payload: StockEntryCreatePayload,
): Promise<StockEntryItem> {
  return inventoryRequest<StockEntryItem>('/inventory/orders/inbound', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** `POST /inventory/orders/outbound` — Registra una salida por despacho o baja (`StockExit`, requiere JWT). */
export async function createOutboundOrder(
  payload: StockExitCreatePayload,
): Promise<StockExitItem> {
  return inventoryRequest<StockExitItem>('/inventory/orders/outbound', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

/** `GET /inventory/orders` — Obtiene el historial consolidado de entradas y salidas con datos del SKU y `user_uuid`. */
export async function fetchInventoryOrders(
  warehouse?: WarehouseCode,
  signal?: AbortSignal,
): Promise<StockOrderItem[]> {
  const query = warehouse ? `?warehouse=${encodeURIComponent(warehouse)}` : '';
  const data = await inventoryRequest<unknown>(`/inventory/orders${query}`, {
    method: 'GET',
    signal,
  });
  return Array.isArray(data) ? (data as StockOrderItem[]) : [];
}
