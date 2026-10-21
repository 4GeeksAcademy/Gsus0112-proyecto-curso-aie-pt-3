'use client';

import { useState } from 'react';
import type { ChangeEvent, FormEvent, ReactElement } from 'react';

import { AuthGuard } from '@/src/components/AuthGuard';
import { Sidebar } from '@/src/components/Sidebar';
import { fetchWithAuth } from '@/src/utils/api';

type AnalysisResults = {
  total_records: number;
  valid_records: number;
  invalid_records: number;
  invalid_reasons: Record<string, number>;
  categories: Record<string, number>;
  statuses: Record<string, number>;
  countries: Record<string, number>;
  satisfaction_scores: Record<string, number>;
  average_satisfaction: number | null;
};

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

const CATEGORIES = ['LOST_PARCEL', 'DELAYED_DELIVERY', 'WRONG_ADDRESS', 'RETURN_REQUEST', 'DAMAGE'] as const;
const STATUSES = ['OPEN', 'CLOSED', 'DISCARDED'] as const;
const SCORES = ['1', '2', '3', '4', '5'] as const;

const formatNumber = (value: number): string => value.toLocaleString('es-ES');

async function readErrorDetail(response: Response, fallback: string): Promise<string> {
  try {
    const data: unknown = await response.json();
    if (typeof data === 'object' && data !== null && 'detail' in data && typeof data.detail === 'string') {
      return data.detail;
    }
  } catch {
    // Non-JSON body: fall back to the generic message.
  }
  return fallback;
}

function MetricCard({ label, value, tone }: { label: string; value: string; tone: 'slate' | 'emerald' | 'red' }): ReactElement {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-900',
    emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    red: 'border-red-200 bg-red-50 text-red-700',
  };
  return (
    <div className={`rounded-xl border p-5 shadow-sm ${tones[tone]}`}>
      <p className="text-sm font-medium opacity-80">{label}</p>
      <p className="mt-2 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function BreakdownCard({ title, rows, total }: { title: string; rows: [string, number][]; total: number }): ReactElement {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-4 font-bold text-slate-900">{title}</h3>
      <ul className="space-y-3">
        {rows.map(([label, count]) => {
          const percent = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <li key={label}>
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{label}</span>
                <span className="font-mono font-bold text-slate-900">
                  {formatNumber(count)} <span className="font-normal text-slate-400">({percent}%)</span>
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-slate-100">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${percent}%` }} />
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ResultsDashboard({ results }: { results: AnalysisResults }): ReactElement {
  const invalidRows = Object.entries(results.invalid_reasons).sort((a, b) => b[1] - a[1]);
  const categoryRows: [string, number][] = CATEGORIES.map((key) => [key, results.categories[key] ?? 0]);
  const statusRows: [string, number][] = STATUSES.map((key) => [key, results.statuses[key] ?? 0]);
  const scoreRows: [string, number][] = SCORES.map((key) => [`${key} ★`, results.satisfaction_scores[key] ?? 0]);
  const scoredTotal = scoreRows.reduce((sum, [, count]) => sum + count, 0);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Métricas generales">
        <MetricCard label="Total de registros" value={formatNumber(results.total_records)} tone="slate" />
        <MetricCard label="Válidos" value={formatNumber(results.valid_records)} tone="emerald" />
        <MetricCard label="Inválidos / Incompletos" value={formatNumber(results.invalid_records)} tone="red" />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-bold text-slate-900">Desglose de inválidos</h3>
          <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">
            {formatNumber(results.invalid_records)} registros
          </span>
        </div>
        {invalidRows.length === 0 ? (
          <p className="text-sm text-slate-500">No se encontraron registros corruptos.</p>
        ) : (
          <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {invalidRows.map(([reason, count]) => (
              <li key={reason} className="flex items-center justify-between gap-4 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-800">{REASON_LABELS[reason] ?? reason}</p>
                  <p className="font-mono text-xs text-slate-400">{reason}</p>
                </div>
                <span className="font-mono text-sm font-bold text-red-700">{formatNumber(count)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard title="Desglose por categoría" rows={categoryRows} total={results.valid_records} />
        <BreakdownCard title="Desglose por estado" rows={statusRows} total={results.valid_records} />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="flex flex-col justify-center rounded-xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm font-medium text-emerald-800">Índice de satisfacción promedio</p>
          <p className="mt-2 text-4xl font-extrabold text-emerald-700">
            {results.average_satisfaction === null ? 'N/D' : `${results.average_satisfaction.toLocaleString('es-ES')} / 5`}
          </p>
          <p className="mt-1 text-xs text-emerald-700/80">Basado en {formatNumber(scoredTotal)} puntuaciones</p>
        </div>
        <div className="lg:col-span-2">
          <BreakdownCard title="Distribución de puntajes (1-5)" rows={scoreRows} total={scoredTotal} />
        </div>
      </section>
    </div>
  );
}

function IncidentsContent(): ReactElement {
  const [file, setFile] = useState<File | null>(null);
  const [results, setResults] = useState<AnalysisResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>): void => {
    setFile(event.target.files?.[0] ?? null);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (file === null) {
      setError('Selecciona un archivo CSV antes de analizar.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setError('El archivo debe tener extensión .csv.');
      return;
    }

    setIsLoading(true);
    setError(null);
    const formData = new FormData();
    formData.append('file', file);

    try {
      // No Content-Type header: the browser sets multipart/form-data with its boundary.
      const response = await fetchWithAuth('/api/incidents/analyze', { method: 'POST', body: formData });
      if (!response.ok) {
        setError(await readErrorDetail(response, `El análisis no se completó (HTTP ${response.status}).`));
        return;
      }
      setResults((await response.json()) as AnalysisResults);
    } catch {
      setError('No se pudo conectar con la API. Inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async (): Promise<void> => {
    setIsExporting(true);
    setError(null);
    try {
      const response = await fetchWithAuth('/api/incidents/results/export');
      if (!response.ok) {
        setError(await readErrorDetail(response, `No se pudo descargar el CSV (HTTP ${response.status}).`));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'results.csv';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError('No se pudo conectar con la API. Inténtalo de nuevo.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64">
      <Sidebar />
      <main className="min-w-0">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Analizador de Incidencias</h1>
            <p className="mt-1 text-sm text-slate-500">Sube un CSV de incidencias para validar registros y obtener métricas.</p>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label htmlFor="incidents-file" className="block text-sm font-medium text-slate-700">
                Archivo CSV
              </label>
              <input
                id="incidents-file"
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="mt-1 block w-full text-sm text-slate-700 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || file === null}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Analizando…' : 'Analizar'}
            </button>
          </form>

          {error !== null && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {results !== null && (
            <>
              <ResultsDashboard results={results} />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleExport}
                  disabled={isExporting}
                  className="rounded-lg border border-emerald-600 bg-white px-5 py-2.5 text-sm font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isExporting ? 'Descargando…' : 'Descargar CSV de Resultados'}
                </button>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

/** Página protegida para analizar CSVs de incidencias y exportar los resultados. */
export default function IncidentsPage(): ReactElement {
  return (
    <AuthGuard>
      <IncidentsContent />
    </AuthGuard>
  );
}
