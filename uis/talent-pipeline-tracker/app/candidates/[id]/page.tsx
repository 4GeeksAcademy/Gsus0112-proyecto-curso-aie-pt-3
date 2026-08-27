'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

import CandidateFormModal from '@/src/components/CandidateFormModal';
import NotesSection from '@/src/components/NotesSection';
import StatusStageControls from '@/src/components/StatusStageControls';
import { getRecordById } from '@/src/services/api';
import { CandidateRecord, CandidateStage, CandidateStatus, STAGE_LABELS, STATUS_LABELS } from '@/src/types/candidate';

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

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(date);
}

export default function CandidateDetailPage() {
  const params = useParams<{ id: string }>();
  const candidateId = params?.id;

  const [candidate, setCandidate] = useState<CandidateRecord | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);

  useEffect(() => {
    if (!candidateId) {
      return;
    }

    let isMounted = true;

    const fetchCandidate = async () => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const data = await getRecordById(candidateId);
        if (isMounted) {
          setCandidate(data);
        }
      } catch (error) {
        if (isMounted) {
          const message = error instanceof Error ? error.message : 'No se pudo cargar la candidatura.';
          setErrorMessage(message);
          setCandidate(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void fetchCandidate();

    return () => {
      isMounted = false;
    };
  }, [candidateId, retryCount]);

  return (
    <div className="min-h-screen bg-slate-50">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8 md:px-8">
        <Link href="/" className="text-sm font-medium text-sky-700 hover:text-sky-800 hover:underline">
          ← Volver al listado
        </Link>

        {isLoading ? (
          <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="animate-pulse space-y-4">
              <div className="h-7 w-72 rounded bg-slate-200" />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="h-5 rounded bg-slate-100" />
                <div className="h-5 rounded bg-slate-100" />
                <div className="h-5 rounded bg-slate-100" />
                <div className="h-5 rounded bg-slate-100" />
              </div>
            </div>
          </section>
        ) : null}

        {!isLoading && errorMessage ? (
          <section className="rounded-xl border border-rose-200 bg-rose-50 p-6 text-rose-900 shadow-sm">
            <p className="font-semibold">No fue posible cargar el detalle de la candidatura.</p>
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

        {!isLoading && !errorMessage && candidate ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div>
                  <h1 className="text-2xl font-bold text-slate-900">{candidate.full_name}</h1>
                  <p className="mt-1 text-sm text-slate-600">Puesto: {candidate.position}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditModalOpen(true);
                  }}
                  className="inline-flex items-center justify-center rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
                >
                  Editar Candidatura
                </button>
              </div>

              <div className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-700 md:grid-cols-2">
                <p>
                  <span className="font-semibold text-slate-900">Email: </span>
                  <a href={`mailto:${candidate.email}`} className="text-sky-700 hover:underline">
                    {candidate.email}
                  </a>
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Teléfono: </span>
                  {candidate.phone}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Años de Experiencia: </span>
                  {candidate.experience_years}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">Fecha de Aplicación: </span>
                  {formatDate(candidate.applied_at)}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">LinkedIn: </span>
                  {candidate.linkedin_url ? (
                    <a
                      href={candidate.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 hover:underline"
                    >
                      Ver perfil
                    </a>
                  ) : (
                    'No disponible'
                  )}
                </p>
                <p>
                  <span className="font-semibold text-slate-900">CV: </span>
                  {candidate.cv_url ? (
                    <a
                      href={candidate.cv_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-700 hover:underline"
                    >
                      Ver CV
                    </a>
                  ) : (
                    'No disponible'
                  )}
                </p>
              </div>

              <div className="mt-5 flex flex-wrap gap-3">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusBadgeStyles[candidate.status]}`}>
                  Estado: {STATUS_LABELS[candidate.status]}
                </span>
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${stageBadgeStyles[candidate.stage]}`}>
                  Etapa: {STAGE_LABELS[candidate.stage]}
                </span>
              </div>
            </section>

            <StatusStageControls
              candidateId={candidate.id}
              currentStatus={candidate.status}
              currentStage={candidate.stage}
              onUpdate={(updatedCandidate) => {
                setCandidate(updatedCandidate);
              }}
            />

            <NotesSection candidateId={candidate.id} />

            <CandidateFormModal
              isOpen={isEditModalOpen}
              onClose={() => {
                setIsEditModalOpen(false);
              }}
              onSuccess={() => {
                setRetryCount((previous) => previous + 1);
              }}
              candidateToEdit={candidate}
            />
          </>
        ) : null}
      </main>
    </div>
  );
}
