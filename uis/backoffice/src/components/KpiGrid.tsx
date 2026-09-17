const kpis = [
  { label: 'Red activa', value: '8', unit: 'transportistas', indicator: 'bg-emerald-500' },
  { label: 'Huella operativa', value: '2', unit: 'almacenes', indicator: 'bg-blue-500' },
  { label: 'Tasa de devoluciones', value: '18–25%', unit: 'según cliente y país', indicator: 'bg-amber-500' },
  { label: 'Potencial CX', value: '80%', unit: 'consultas automatizables', indicator: 'bg-rose-500' },
];

/** Presenta indicadores de negocio confirmados en el briefing. */
export function KpiGrid(): React.ReactElement {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de operación">
      {kpis.map((kpi) => (
        <article className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm" key={kpi.label}>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-500">{kpi.label}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${kpi.indicator}`} />
          </div>
          <strong className="mt-5 block text-3xl font-bold text-slate-900">{kpi.value}</strong>
          <small className="mt-2 block text-sm text-slate-500">{kpi.unit}</small>
        </article>
      ))}
    </section>
  );
}
