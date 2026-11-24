import React from 'react';
import { MetricCard } from './MetricCard';

const kpis = [
  { id: 'envios', label: 'Red activa', value: '8', unit: 'transportistas', indicator: 'bg-emerald-500' },
  { id: 'huella-operativa', label: 'Huella operativa', value: '2', unit: 'almacenes', indicator: 'bg-blue-500' },
  { id: 'devoluciones', label: 'Tasa de devoluciones', value: '18–25%', unit: 'según cliente y país', indicator: 'bg-amber-500' },
  { id: 'experiencia-cliente', label: 'Potencial CX', value: '80%', unit: 'consultas automatizables', indicator: 'bg-rose-500' },
];

/** Presenta indicadores de negocio confirmados en el briefing utilizando el componente compartido MetricCard. */
export function KpiGrid(): React.ReactElement {
  return (
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores de operación">
      {kpis.map((kpi) => (
        <MetricCard
          key={kpi.id}
          id={kpi.id}
          label={kpi.label}
          value={kpi.value}
          unit={kpi.unit}
          indicatorColor={kpi.indicator}
          variant="bordered"
        />
      ))}
    </section>
  );
}
