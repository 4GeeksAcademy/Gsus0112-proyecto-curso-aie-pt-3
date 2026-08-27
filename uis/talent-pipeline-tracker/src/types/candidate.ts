export type CandidateStatus =
  | 'received'
  | 'in_progress'
  | 'selected'
  | 'discarded';

export type CandidateStage =
  | 'pending'
  | 'review'
  | 'personal_interview'
  | 'technical_interview'
  | 'offer_presented';

export interface CandidateRecord {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  position: string;
  linkedin_url: string | null;
  cv_url: string | null;
  status: CandidateStatus;
  stage: CandidateStage;
  experience_years: number;
  notes_count: number;
  applied_at: string;
  updated_at: string;
}

export interface CandidateCreateInput {
  full_name: string;
  email: string;
  phone: string;
  position: string;
  experience_years: number;
  linkedin_url?: string;
  cv_url?: string;
}

export interface CandidatePatchInput {
  status?: CandidateStatus;
  stage?: CandidateStage;
}

export interface CandidateNote {
  id: string;
  content: string;
  created_at: string;
}

export interface NoteCreateInput {
  content: string;
}

export const STATUS_LABELS: Record<CandidateStatus, string> = {
  received: 'Recibida',
  in_progress: 'En Proceso',
  selected: 'Seleccionado',
  discarded: 'Descartado',
};

export const STAGE_LABELS: Record<CandidateStage, string> = {
  pending: 'Pendiente',
  review: 'Revisión',
  personal_interview: 'Entrevista Personal',
  technical_interview: 'Entrevista Técnica',
  offer_presented: 'Oferta Presentada',
};

export const TRACKFLOW_POSITIONS = [
  'Operario de Almacén - Los Ángeles',
  'Operario de Almacén - Zaragoza',
  'Coordinador de Última Milla',
  'Desarrollador Full Stack',
  'Data Engineer',
  'Agente de Atención al Cliente - LA',
  'Agente de Atención al Cliente - Zaragoza',
  'Especialista en Logística Inversa',
  'Account Manager B2B',
  'Responsable de Almacén',
] as const;
