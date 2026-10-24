/**
 * Tipos, constantes y etiquetas según el BRIEFING de TrackFlow para el Gestor de Incidencias Centralizado.
 */

export type IncidentStatus = 'open' | 'in_progress' | 'resolved' | 'discarded';

export type IncidentOrigin = 'customer' | 'branch' | 'internal';

export type IncidentBranch =
  | 'central'
  | 'la_warehouse'
  | 'la_office'
  | 'zaragoza_warehouse'
  | 'zaragoza_office';

export type IncidentCategory =
  | 'lost_parcel'
  | 'carrier_issue'
  | 'delivery_failure'
  | 'returns_issue'
  | 'inventory_discrepancy';

export interface Incident {
  id: number;
  title: string;
  description: string;
  category: IncidentCategory;
  status: IncidentStatus;
  origin: IncidentOrigin;
  branch: IncidentBranch;
  created_at: string;
  updated_at: string;
}

export interface IncidentCreateInput {
  title: string;
  description: string;
  category: IncidentCategory;
  origin: IncidentOrigin;
  branch: IncidentBranch;
  status?: IncidentStatus;
}

export interface IncidentSummary {
  total: number;
  by_status: Record<IncidentStatus, number>;
  by_category: Record<IncidentCategory, number>;
  by_origin: Record<IncidentOrigin, number>;
  by_branch: Record<IncidentBranch, number>;
}

export interface IncidentFilters {
  status?: IncidentStatus | '';
  origin?: IncidentOrigin | '';
  branch?: IncidentBranch | '';
  category?: IncidentCategory | '';
}

export const STATUS_OPTIONS: readonly { value: IncidentStatus; label: string }[] = [
  { value: 'open', label: 'Abierta' },
  { value: 'in_progress', label: 'En progreso' },
  { value: 'resolved', label: 'Resuelta' },
  { value: 'discarded', label: 'Descartada' },
] as const;

export const ORIGIN_OPTIONS: readonly { value: IncidentOrigin; label: string }[] = [
  { value: 'customer', label: 'Cliente' },
  { value: 'branch', label: 'Sede operativa' },
  { value: 'internal', label: 'Interno' },
] as const;

export const BRANCH_OPTIONS: readonly { value: IncidentBranch; label: string }[] = [
  { value: 'central', label: 'Central' },
  { value: 'la_warehouse', label: 'Los Ángeles — Almacén' },
  { value: 'la_office', label: 'Los Ángeles — Oficina' },
  { value: 'zaragoza_warehouse', label: 'Zaragoza — Almacén' },
  { value: 'zaragoza_office', label: 'Zaragoza — Oficina' },
] as const;

export const CATEGORY_OPTIONS: readonly {
  value: IncidentCategory;
  label: string;
  shortLabel: string;
}[] = [
  {
    value: 'lost_parcel',
    shortLabel: 'Paquete extraviado (lost_parcel)',
    label: 'Paquete extraviado en tránsito o en el almacén',
  },
  {
    value: 'carrier_issue',
    shortLabel: 'Incidencia de transportista (carrier_issue)',
    label: 'Incidencia atribuible al transportista: retraso, daño, incumplimiento de SLA',
  },
  {
    value: 'delivery_failure',
    shortLabel: 'Fallo en la entrega (delivery_failure)',
    label: 'Fallo en la entrega: intento fallido, dirección incorrecta, destinatario ausente no gestionado',
  },
  {
    value: 'returns_issue',
    shortLabel: 'Incidencia en devoluciones (returns_issue)',
    label: 'Problema en el proceso de devoluciones o logística inversa',
  },
  {
    value: 'inventory_discrepancy',
    shortLabel: 'Discrepancia de inventario (inventory_discrepancy)',
    label: 'Diferencia entre el stock registrado y el stock físico',
  },
] as const;

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  open: 'Abierta',
  in_progress: 'En progreso',
  resolved: 'Resuelta',
  discarded: 'Descartada',
};

export const ORIGIN_LABELS: Record<IncidentOrigin, string> = {
  customer: 'Cliente',
  branch: 'Sede operativa',
  internal: 'Interno',
};

export const BRANCH_LABELS: Record<IncidentBranch, string> = {
  central: 'Central',
  la_warehouse: 'Los Ángeles — Almacén',
  la_office: 'Los Ángeles — Oficina',
  zaragoza_warehouse: 'Zaragoza — Almacén',
  zaragoza_office: 'Zaragoza — Oficina',
};

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  lost_parcel: 'Paquete extraviado',
  carrier_issue: 'Incidencia de transportista',
  delivery_failure: 'Fallo en la entrega',
  returns_issue: 'Incidencia en devoluciones',
  inventory_discrepancy: 'Discrepancia de inventario',
};

export const ALLOWED_STATUS_TRANSITIONS: Record<IncidentStatus, readonly IncidentStatus[]> = {
  open: ['in_progress', 'discarded'],
  in_progress: ['resolved', 'discarded'],
  resolved: [],
  discarded: [],
};
