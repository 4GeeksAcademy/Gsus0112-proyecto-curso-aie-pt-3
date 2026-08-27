'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { CandidateStage, CandidateStatus, STAGE_LABELS, STATUS_LABELS } from '@/src/types/candidate';

type FilterBarProps = {
  initialStatus?: CandidateStatus;
  initialStage?: CandidateStage;
  initialSearch?: string;
};

const STATUS_OPTIONS: Array<{ value: CandidateStatus; label: string }> = [
  { value: 'received', label: STATUS_LABELS.received },
  { value: 'in_progress', label: STATUS_LABELS.in_progress },
  { value: 'selected', label: STATUS_LABELS.selected },
  { value: 'discarded', label: STATUS_LABELS.discarded },
];

const STAGE_OPTIONS: Array<{ value: CandidateStage; label: string }> = [
  { value: 'pending', label: STAGE_LABELS.pending },
  { value: 'review', label: STAGE_LABELS.review },
  { value: 'personal_interview', label: STAGE_LABELS.personal_interview },
  { value: 'technical_interview', label: STAGE_LABELS.technical_interview },
  { value: 'offer_presented', label: STAGE_LABELS.offer_presented },
];

export default function FilterBar({ initialStatus, initialStage, initialSearch = '' }: FilterBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [statusValue, setStatusValue] = useState<string>(initialStatus ?? '');
  const [stageValue, setStageValue] = useState<string>(initialStage ?? '');
  const [searchValue, setSearchValue] = useState<string>(initialSearch);

  useEffect(() => {
    setStatusValue(initialStatus ?? '');
  }, [initialStatus]);

  useEffect(() => {
    setStageValue(initialStage ?? '');
  }, [initialStage]);

  useEffect(() => {
    setSearchValue(initialSearch);
  }, [initialSearch]);

  const updateParam = (key: 'status' | 'stage' | 'search', value: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }

    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Estado
          <select
            value={statusValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setStatusValue(nextValue);
              updateParam('status', nextValue);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-sky-500"
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Etapa
          <select
            value={stageValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setStageValue(nextValue);
              updateParam('stage', nextValue);
            }}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-sky-500"
          >
            <option value="">Todos</option>
            {STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Buscar por nombre o email
          <input
            type="text"
            value={searchValue}
            onChange={(event) => {
              const nextValue = event.target.value;
              setSearchValue(nextValue);
              updateParam('search', nextValue.trim());
            }}
            placeholder="Ej. Ana Martinez o ana@trackflow.com"
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-sky-500"
          />
        </label>
      </div>
    </div>
  );
}
