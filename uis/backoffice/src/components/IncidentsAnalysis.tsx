'use client';

import { useRef, useState } from 'react';
import type { DragEvent, ReactElement } from 'react';

import { API_BASE_URL } from '../utils/api';

const REASON_LABELS: Record<string, string> = {
  INVALID_COUNTRY: 'País no permitido',
  MISSING_CARRIER: 'Transportista vacío',
  CARRIER_COUNTRY_MISMATCH: 'Transportista no válido para el país',
  INVALID_TRACKING_NUMBER: 'Número de seguimiento demasiado corto',
  INVALID_CATEGORY: 'Categoría no válida',
  DESCRIPTION_TOO_SHORT: 'Descripción demasiado corta',
  INVALID_EMAIL: 'Email sin arroba',
  MISSING_SATISFACTION_SCORE: 'Falta puntuación en incidencia cerrada',
  INVALID_SATISFACTION_SCORE: 'Puntuación fuera del rango 1-5',
};

type AnalysisResults = {
  total_records: number;
  valid_records: number;
  invalid_records: number;
  invalid_reasons: Record<string, number>;
  average_satisfaction: number | null;
};

/** Componente de carga y análisis de ficheros CSV de incidencias logísticas. */
export function IncidentsAnalysis(): ReactElement {
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [lastFile, setLastFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const analyzeFile = async (file?: File): Promise<void> => {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setErrorMsg('Selecciona un archivo válido con extensión .csv para poder analizarlo.');
      return;
    }

    setLastFile(file);
    setLoading(true);
    setErrorMsg('');
    const formData = new FormData();
    formData.append('file', file);

    let response: Response;
    try {
      response = await fetch(`${API_BASE_URL}/api/incidents/analyze`, {
        method: 'POST',
        body: formData,
      });
    } catch {
      setErrorMsg(
        'No se pudo conectar con el servidor de análisis. Verifica tu conexión o que la API esté activa e inténtalo de nuevo.',
      );
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    try {
      if (!response.ok) {
        const errorPayload: { detail?: string } | null = await response.json().catch(() => null);
        const detail = typeof errorPayload?.detail === 'string' ? errorPayload.detail : null;
        setErrorMsg(
          response.status === 400 && detail
            ? detail
            : 'No pudimos procesar el archivo CSV en este momento. Revisa que el formato sea correcto e inténtalo de nuevo.',
        );
        return;
      }

      let data: AnalysisResults;
      try {
        data = (await response.json()) as AnalysisResults;
      } catch {
        setErrorMsg(
          'La respuesta del servidor no tiene un formato válido. Por favor, vuelve a intentarlo.',
        );
        return;
      }

      setResults(data);
      setFilename(file.name);
    } finally {
      setLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDragOver = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>): void => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer?.files?.[0];
    if (droppedFile) {
      void analyzeFile(droppedFile);
    }
  };

  const reset = (): void => {
    setResults(null);
    setFilename('');
    setErrorMsg('');
    setLastFile(null);
  };

  return (
    <section id="incidencias" className="mt-12 scroll-mt-8">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-slate-900">Análisis de Incidencias</h2>
        <p className="text-sm text-slate-500">Control de calidad de los registros logísticos y análisis en lote.</p>
      </div>

      {!results ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div 
            className={`relative flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-12 transition-colors ${isDragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-300 hover:border-slate-400'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              ref={fileInputRef}
              type="file" 
              accept=".csv,text/csv" 
              className="hidden" 
              onChange={(e) => analyzeFile(e.target.files?.[0])}
            />
            <div className="mb-3 rounded-full bg-slate-100 p-3 text-slate-500">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-900">Arrastra tu archivo CSV aquí</p>
            <p className="mt-1 text-xs text-slate-500">o haz clic para seleccionarlo desde tu equipo</p>
            
            {loading && <p className="mt-4 text-sm font-semibold text-emerald-600 animate-pulse">Analizando archivo...</p>}
            {errorMsg && (
              <div
                role="alert"
                onClick={(e) => e.stopPropagation()}
                className="mt-4 w-full max-w-md rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-700"
              >
                <p className="font-semibold">{errorMsg}</p>
                <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                  {lastFile ? (
                    <button
                      type="button"
                      onClick={() => void analyzeFile(lastFile)}
                      className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
                    >
                      Reintentar análisis
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 transition hover:bg-red-100"
                  >
                    Seleccionar otro archivo
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-emerald-600">Análisis completado</p>
              <h3 className="text-lg font-bold text-slate-900">{filename || 'Archivo CSV'}</h3>
            </div>
            <div className="flex w-full gap-3 sm:w-auto">
              <button 
                onClick={reset}
                className="flex-1 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 sm:flex-none"
              >
                Analizar otro
              </button>
              <a 
                href={`${API_BASE_URL}/api/incidents/results/export`}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 sm:flex-none text-center"
              >
                Descargar CSV
              </a>
            </div>
          </div>

          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Total de registros</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">{(results?.total_records ?? 0).toLocaleString('es-ES')}</p>
            </div>
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4">
              <p className="text-sm font-medium text-emerald-800">Registros válidos</p>
              <p className="mt-2 text-3xl font-extrabold text-emerald-700">{(results?.valid_records ?? 0).toLocaleString('es-ES')}</p>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-medium text-slate-500">Satisfacción promedio</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-900">
                {results?.average_satisfaction === null || results?.average_satisfaction === undefined
                  ? 'N/D'
                  : `${results.average_satisfaction.toLocaleString('es-ES')} / 5`}
              </p>
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <h4 className="font-bold text-slate-900">Registros inválidos</h4>
              <span className="rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700">
                {(results?.invalid_records ?? 0).toLocaleString('es-ES')} encontrados
              </span>
            </div>
            
            {Object.keys(results?.invalid_reasons ?? {}).length === 0 ? (
              <p className="text-sm text-slate-500">No se encontraron problemas de validación.</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {Object.entries(results?.invalid_reasons ?? {})
                  .sort((a, b) => b[1] - a[1])
                  .map(([reason, count]) => (
                    <li key={reason} className="flex items-center justify-between p-4">
                      <span className="text-sm font-medium text-slate-700">{REASON_LABELS[reason] ?? reason}</span>
                      <span className="font-mono text-sm font-bold text-slate-900">{(count ?? 0).toLocaleString('es-ES')}</span>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
