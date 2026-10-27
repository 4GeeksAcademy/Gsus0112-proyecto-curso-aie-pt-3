import type { IncidentStatus } from '../types/incidents';

/** Devuelve las clases semánticas de insignia según el estado operativo de la incidencia. */
export function getStatusBadgeClasses(status: IncidentStatus): string {
  switch (status) {
    case 'open':
      return 'bg-amber-100 text-amber-800 border-amber-200';
    case 'in_progress':
      return 'bg-sky-100 text-sky-800 border-sky-200';
    case 'resolved':
      return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'discarded':
      return 'bg-slate-200 text-slate-700 border-slate-300';
  }
}

/** Formatea una fecha ISO-8601 a formato corto es-ES o devuelve guion / valor original si no es válida. */
export function formatDate(isoString: string): string {
  if (!isoString) return '—';
  const parsed = new Date(isoString);
  if (Number.isNaN(parsed.getTime())) {
    return isoString;
  }
  return parsed.toLocaleDateString('es-ES', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  });
}
