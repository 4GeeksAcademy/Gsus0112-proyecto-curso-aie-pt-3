/**
 * Tipos y constantes compartidas para el Gestor de Incidencias Centralizado de TrackFlow.
 */

export type Id = string;

export interface BaseEntity {
  id: Id;
  createdAt?: string;
  updatedAt?: string;
}

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

export interface IncidentCreatePayload {
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

export const INCIDENT_STATUSES: readonly IncidentStatus[] = [
  'open',
  'in_progress',
  'resolved',
  'discarded',
] as const;

export const INCIDENT_ORIGINS: readonly IncidentOrigin[] = [
  'customer',
  'branch',
  'internal',
] as const;

export const INCIDENT_BRANCHES: readonly IncidentBranch[] = [
  'central',
  'la_warehouse',
  'la_office',
  'zaragoza_warehouse',
  'zaragoza_office',
] as const;

export const INCIDENT_CATEGORIES: readonly IncidentCategory[] = [
  'lost_parcel',
  'carrier_issue',
  'delivery_failure',
  'returns_issue',
  'inventory_discrepancy',
] as const;
