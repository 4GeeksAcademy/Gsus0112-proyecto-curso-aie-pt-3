'use client';

import { useEffect, useState } from 'react';

import { patchRecord } from '@/src/services/api';
import {
  CandidateRecord,
  CandidateStage,
  CandidateStatus,
  STAGE_LABELS,
  STATUS_LABELS,
} from '@/src/types/candidate';

type StatusStageControlsProps = {
  candidateId: string;
  currentStatus: CandidateStatus;
  currentStage: CandidateStage;
  onUpdate: (candidate: CandidateRecord) => void;
};

export default function StatusStageControls({
  candidateId,
  currentStatus,
  currentStage,
  onUpdate,
}: StatusStageControlsProps) {
  const [statusValue, setStatusValue] = useState<CandidateStatus>(currentStatus);
  const [stageValue, setStageValue] = useState<CandidateStage>(currentStage);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setStatusValue(currentStatus);
  }, [currentStatus]);

  useEffect(() => {
    setStageValue(currentStage);
  }, [currentStage]);

  const updateStatus = async (nextStatus: CandidateStatus) => {
    const previousStatus = statusValue;
    setStatusValue(nextStatus);
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsUpdating(true);

    try {
      const updated = await patchRecord(candidateId, { status: nextStatus });
      onUpdate(updated);
      setSuccessMessage('Estado actualizado correctamente.');
    } catch (error) {
      setStatusValue(previousStatus);
      const message = error instanceof Error ? error.message : 'No se pudo actualizar el estado.';
      setErrorMessage(message);
    } finally {
      setIsUpdating(false);
    }
  };

  const updateStage = async (nextStage: CandidateStage) => {
    const previousStage = stageValue;
    setStageValue(nextStage);
    setSuccessMessage(null);
    setErrorMessage(null);
    setIsUpdating(true);

    try {
      const updated = await patchRecord(candidateId, { stage: nextStage });
      onUpdate(updated);
      setSuccessMessage('Etapa actualizada correctamente.');
    } catch (error) {
      setStageValue(previousStage);
      const message = error instanceof Error ? error.message : 'No se pudo actualizar la etapa.';
      setErrorMessage(message);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Actualizar Estado y Etapa</h3>

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Estado
          <select
            value={statusValue}
            onChange={(event) => {
              const nextStatus = event.target.value as CandidateStatus;
              if (nextStatus !== statusValue) {
                void updateStatus(nextStatus);
              }
            }}
            disabled={isUpdating}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {(Object.keys(STATUS_LABELS) as CandidateStatus[]).map((status) => (
              <option key={status} value={status}>
                {STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1 text-sm text-slate-700">
          Etapa
          <select
            value={stageValue}
            onChange={(event) => {
              const nextStage = event.target.value as CandidateStage;
              if (nextStage !== stageValue) {
                void updateStage(nextStage);
              }
            }}
            disabled={isUpdating}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-500 disabled:cursor-not-allowed disabled:bg-slate-100"
          >
            {(Object.keys(STAGE_LABELS) as CandidateStage[]).map((stage) => (
              <option key={stage} value={stage}>
                {STAGE_LABELS[stage]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-3 min-h-6 text-sm">
        {isUpdating ? <p className="text-slate-600">Actualizando...</p> : null}
        {!isUpdating && successMessage ? <p className="text-emerald-700">✓ {successMessage}</p> : null}
        {!isUpdating && errorMessage ? <p className="text-rose-700">{errorMessage}</p> : null}
      </div>
    </section>
  );
}
