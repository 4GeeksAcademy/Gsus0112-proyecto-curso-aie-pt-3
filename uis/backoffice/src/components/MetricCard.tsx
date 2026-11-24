import React from 'react';

export interface MetricCardProps {
  value: string;
  label: string;
  unit?: string;
  indicatorColor?: string;
  variant?: 'minimal' | 'bordered';
  id?: string;
  className?: string;
}

/** Componente reutilizable para renderizar cifras operativas y KPIs de forma consistente. */
export function MetricCard({
  value,
  label,
  unit,
  indicatorColor,
  variant = 'bordered',
  id,
  className = '',
}: MetricCardProps): React.ReactElement {
  if (variant === 'minimal') {
    return (
      <div
        id={id}
        className={`border-b border-r border-slate-100 p-6 text-center last:border-r-0 sm:p-8 lg:border-b-0 ${className}`}
      >
        <strong className="block text-4xl font-extrabold text-emerald-600">{value}</strong>
        <span className="mt-2 block text-sm text-slate-600">{label}</span>
        {unit && <small className="mt-1 block text-xs text-slate-500">{unit}</small>}
      </div>
    );
  }

  return (
    <article
      id={id}
      className={`scroll-mt-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm ${className}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">{label}</span>
        {indicatorColor && (
          <span
            className={`h-2.5 w-2.5 rounded-full ${indicatorColor}`}
            aria-hidden="true"
          />
        )}
      </div>
      <strong className="mt-5 block text-3xl font-bold text-slate-900">{value}</strong>
      {unit && <small className="mt-2 block text-sm text-slate-600">{unit}</small>}
    </article>
  );
}
