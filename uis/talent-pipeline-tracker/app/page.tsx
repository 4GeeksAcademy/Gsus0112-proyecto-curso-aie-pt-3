'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import CandidateTable from '@/src/components/CandidateTable';
import CandidateFormModal from '@/src/components/CandidateFormModal';
import FilterBar from '@/src/components/FilterBar';
import { getRecords } from '@/src/services/api';
import { CandidateRecord, CandidateStage, CandidateStatus } from '@/src/types/candidate';

const VALID_STATUSES: CandidateStatus[] = ['received', 'in_progress', 'selected', 'discarded'];
const VALID_STAGES: CandidateStage[] = [
  'pending',
  'review',
  'personal_interview',
  'technical_interview',
  'offer_presented',
];

function isCandidateStatus(value: string): value is CandidateStatus {
  return VALID_STATUSES.includes(value as CandidateStatus);
}

function isCandidateStage(value: string): value is CandidateStage {
  return VALID_STAGES.includes(value as CandidateStage);
}

function HomePageContent() {
  const searchParams = useSearchParams();

  const [records, setRecords] = useState<CandidateRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);

  const statusParam = useMemo(() => {
    const value = searchParams.get('status');
    return value && isCandidateStatus(value) ? value : undefined;
  }, [searchParams]);

  const stageParam = useMemo(() => {
    const value = searchParams.get('stage');
    return value && isCandidateStage(value) ? value : undefined;
  }, [searchParams]);

  const searchTerm = useMemo(() => searchParams.get('search') ?? '', [searchParams]);

  useEffect(() => {
    let isMounted = true;

    const fetchRecords = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getRecords({
          status: statusParam,
          stage: stageParam,
          search: searchTerm || undefined,
        });

        if (isMounted) {
          setRecords(data);
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : 'Ocurrió un error inesperado';
          setErrorMessage(message);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    fetchRecords();

    return () => {
      isMounted = false;
    };
  }, [statusParam, stageParam, searchTerm, retryCount]);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <header className="flex flex-col gap-4 rounded-2xl bg-gradient-to-r from-teal-600 to-sky-700 p-6 shadow-lg md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white md:text-3xl">TrackFlow — People & Talent Pipeline</h1>
            <p className="mt-1 text-sm text-teal-50">Gestión de candidaturas para operaciones de logística B2B.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCreateModalOpen(true);
            }}
            className="inline-flex items-center justify-center rounded-lg border border-white/80 bg-white px-5 py-3 text-sm font-semibold text-teal-700 shadow transition-colors hover:bg-teal-50"
          >
            Nueva Candidatura
          </button>
        </header>

        <FilterBar initialStatus={statusParam} initialStage={stageParam} initialSearch={searchTerm} />

        {isLoading ? (
          <section className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
            <div className="flex items-center justify-center gap-3 text-slate-600">
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
              <span>Cargando candidaturas...</span>
            </div>
          </section>
        ) : null}

        {!isLoading && errorMessage ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
            <p className="font-semibold">No fue posible cargar las candidaturas.</p>
            <p className="mt-1 text-sm">{errorMessage}</p>
            <button
              type="button"
              onClick={() => {
                setRetryCount((previous) => previous + 1);
              }}
              className="mt-4 inline-flex rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-rose-700"
            >
              Reintentar
            </button>
          </section>
        ) : null}

        {!isLoading && !errorMessage ? (
          records.length === 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-10 text-center text-slate-600 shadow-sm">
              No se encontraron candidaturas
            </section>
          ) : (
            <CandidateTable candidates={records} />
          )
        ) : null}
      </main>

      <CandidateFormModal
        isOpen={isCreateModalOpen}
        onClose={() => {
          setIsCreateModalOpen(false);
        }}
        onSuccess={() => {
          setRetryCount((previous) => previous + 1);
        }}
        candidateToEdit={null}
      />
    </div>
  );
}

function HomePageFallback() {
  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 md:px-8">
        <section className="rounded-xl border border-slate-200 bg-white p-10 shadow-sm">
          <div className="flex items-center justify-center gap-3 text-slate-600">
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-600" />
            <span>Cargando candidaturas...</span>
          </div>
        </section>
      </main>
    </div>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<HomePageFallback />}>
      <HomePageContent />
    </Suspense>
  );
}
