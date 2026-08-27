import Link from 'next/link';

import {
  CandidateRecord,
  CandidateStage,
  CandidateStatus,
  STAGE_LABELS,
  STATUS_LABELS,
} from '@/src/types/candidate';

type CandidateTableProps = {
  candidates: CandidateRecord[];
};

const statusBadgeStyles: Record<CandidateStatus, string> = {
  received: 'bg-slate-200 text-slate-800',
  in_progress: 'bg-amber-200 text-amber-900',
  selected: 'bg-emerald-200 text-emerald-900',
  discarded: 'bg-rose-200 text-rose-900',
};

const stageBadgeStyles: Record<CandidateStage, string> = {
  pending: 'bg-zinc-200 text-zinc-800',
  review: 'bg-sky-200 text-sky-900',
  personal_interview: 'bg-indigo-200 text-indigo-900',
  technical_interview: 'bg-cyan-200 text-cyan-900',
  offer_presented: 'bg-fuchsia-200 text-fuchsia-900',
};

function formatAppliedDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
  }).format(date);
}

export default function CandidateTable({ candidates }: CandidateTableProps) {
  const safeCandidates = Array.isArray(candidates) ? candidates : [];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full text-sm text-slate-700">
        <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">Nombre Completo</th>
            <th className="px-4 py-3">Puesto</th>
            <th className="px-4 py-3">Estado</th>
            <th className="px-4 py-3">Etapa</th>
            <th className="px-4 py-3">Fecha de Aplicación</th>
          </tr>
        </thead>
        <tbody>
          {safeCandidates.map((candidate) => (
            <tr key={candidate.id} className="border-t border-slate-100 transition-colors hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-900">
                <Link href={`/candidates/${candidate.id}`} className="block focus:outline-none focus-visible:underline">
                  {candidate.full_name}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/candidates/${candidate.id}`} className="block focus:outline-none focus-visible:underline">
                  {candidate.position}
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/candidates/${candidate.id}`} className="block focus:outline-none">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeStyles[candidate.status]}`}
                  >
                    {STATUS_LABELS[candidate.status]}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/candidates/${candidate.id}`} className="block focus:outline-none">
                  <span
                    className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageBadgeStyles[candidate.stage]}`}
                  >
                    {STAGE_LABELS[candidate.stage]}
                  </span>
                </Link>
              </td>
              <td className="px-4 py-3">
                <Link href={`/candidates/${candidate.id}`} className="block focus:outline-none focus-visible:underline">
                  {formatAppliedDate(candidate.applied_at)}
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
