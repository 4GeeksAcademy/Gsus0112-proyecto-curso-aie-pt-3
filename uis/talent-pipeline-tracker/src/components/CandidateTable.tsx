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
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {safeCandidates.map((candidate) => (
        <Link
          key={candidate.id}
          href={`/candidates/${candidate.id}`}
          className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        >
          <h3 className="text-lg font-bold text-slate-900 transition-colors group-hover:text-teal-700">{candidate.full_name}</h3>
          <p className="mt-1 text-sm text-slate-500">{candidate.position}</p>

          <div className="mt-4 flex flex-wrap gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadgeStyles[candidate.status]}`}>
              {STATUS_LABELS[candidate.status]}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${stageBadgeStyles[candidate.stage]}`}>
              {STAGE_LABELS[candidate.stage]}
            </span>
          </div>

          <p className="mt-4 text-xs text-slate-500">Aplicó el {formatAppliedDate(candidate.applied_at)}</p>
        </Link>
      ))}
    </div>
  );
}
