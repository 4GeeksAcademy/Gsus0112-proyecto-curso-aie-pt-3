'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

import { createRecord, updateRecord } from '@/src/services/api';
import { CandidateCreateInput, CandidateRecord, TRACKFLOW_POSITIONS } from '@/src/types/candidate';

type CandidateFormModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  candidateToEdit: CandidateRecord | null;
};

type CandidateFormValues = {
  full_name: string;
  email: string;
  phone: string;
  position: string;
  experience_years: string;
  linkedin_url: string;
  cv_url: string;
};

const EMPTY_FORM: CandidateFormValues = {
  full_name: '',
  email: '',
  phone: '',
  position: '',
  experience_years: '0',
  linkedin_url: '',
  cv_url: '',
};

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidUrlOrEmpty(value: string): boolean {
  if (!value.trim()) {
    return true;
  }

  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export default function CandidateFormModal({
  isOpen,
  onClose,
  onSuccess,
  candidateToEdit,
}: CandidateFormModalProps) {
  const isEditMode = useMemo(() => candidateToEdit !== null, [candidateToEdit]);

  const [formValues, setFormValues] = useState<CandidateFormValues>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (candidateToEdit) {
      setFormValues({
        full_name: candidateToEdit.full_name,
        email: candidateToEdit.email,
        phone: candidateToEdit.phone,
        position: candidateToEdit.position,
        experience_years: String(candidateToEdit.experience_years),
        linkedin_url: candidateToEdit.linkedin_url ?? '',
        cv_url: candidateToEdit.cv_url ?? '',
      });
    } else {
      setFormValues(EMPTY_FORM);
    }

    setErrorMessage(null);
    setSuccessMessage(null);
  }, [candidateToEdit, isOpen]);

  useEffect(() => {
    if (!successMessage) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      onSuccess();
      onClose();
      setSuccessMessage(null);
    }, 1000);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [onClose, onSuccess, successMessage]);

  if (!isOpen) {
    return null;
  }

  const handleClose = () => {
    if (isSaving) {
      return;
    }
    onClose();
  };

  const handleInputChange = (field: keyof CandidateFormValues, value: string) => {
    setFormValues((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const validateForm = (): string | null => {
    if (formValues.full_name.trim().length < 2) {
      return 'El nombre completo debe tener al menos 2 caracteres.';
    }

    if (!isValidEmail(formValues.email.trim())) {
      return 'El email no tiene un formato válido.';
    }

    if (!formValues.phone.trim()) {
      return 'El teléfono es obligatorio.';
    }

    if (!formValues.position.trim()) {
      return 'Debes seleccionar un puesto.';
    }

    const experience = Number(formValues.experience_years);
    if (!Number.isFinite(experience) || experience < 0) {
      return 'Los años de experiencia deben ser un número mayor o igual a 0.';
    }

    if (!isValidUrlOrEmpty(formValues.linkedin_url.trim())) {
      return 'La URL de LinkedIn no es válida.';
    }

    if (!isValidUrlOrEmpty(formValues.cv_url.trim())) {
      return 'La URL del CV no es válida.';
    }

    return null;
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    const validationError = validateForm();
    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const payload: CandidateCreateInput = {
      full_name: formValues.full_name.trim(),
      email: formValues.email.trim(),
      phone: formValues.phone.trim(),
      position: formValues.position,
      experience_years: Number(formValues.experience_years),
      linkedin_url: formValues.linkedin_url.trim() || undefined,
      cv_url: formValues.cv_url.trim() || undefined,
    };

    setIsSaving(true);

    try {
      if (candidateToEdit) {
        await updateRecord(candidateToEdit.id, payload);
        setSuccessMessage('Candidatura actualizada');
      } else {
        await createRecord(payload);
        setSuccessMessage('Candidatura registrada');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'No se pudo guardar la candidatura';
      setErrorMessage(message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">
            {isEditMode ? 'Editar Candidatura' : 'Nueva Candidatura'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">Completa la información del perfil para el pipeline de TrackFlow.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm text-slate-700 md:col-span-2">
              Nombre Completo
              <input
                type="text"
                required
                minLength={2}
                value={formValues.full_name}
                onChange={(event) => handleInputChange('full_name', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Email
              <input
                type="email"
                required
                value={formValues.email}
                onChange={(event) => handleInputChange('email', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Teléfono
              <input
                type="tel"
                required
                value={formValues.phone}
                onChange={(event) => handleInputChange('phone', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Puesto
              <select
                required
                value={formValues.position}
                onChange={(event) => handleInputChange('position', event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              >
                <option value="">Selecciona un puesto</option>
                {TRACKFLOW_POSITIONS.map((position) => (
                  <option key={position} value={position}>
                    {position}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Años de Experiencia
              <input
                type="number"
                required
                min={0}
                value={formValues.experience_years}
                onChange={(event) => handleInputChange('experience_years', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              LinkedIn URL
              <input
                type="url"
                value={formValues.linkedin_url}
                onChange={(event) => handleInputChange('linkedin_url', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              />
            </label>

            <label className="flex flex-col gap-1 text-sm text-slate-700">
              Enlace al CV
              <input
                type="url"
                value={formValues.cv_url}
                onChange={(event) => handleInputChange('cv_url', event.target.value)}
                className="rounded-md border border-slate-300 px-3 py-2 text-slate-900 outline-none focus:border-sky-500"
              />
            </label>
          </div>

          {errorMessage ? (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{errorMessage}</div>
          ) : null}

          {successMessage ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {successMessage}
            </div>
          ) : null}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={handleClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-100"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isSaving ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Registrar candidatura'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
