const services = [
  {
    number: '01',
    title: 'Inventario unificado',
    description: 'Control de stock y preparación de pedidos desde Los Ángeles y Zaragoza con una visión compartida.',
    detail: 'Almacenaje · Pick & pack · Alertas',
  },
  {
    number: '02',
    title: 'Motor de transportistas',
    description: 'Asignación inteligente y seguimiento unificado a través de una red de ocho transportistas.',
    detail: 'Última milla · Tracking · Incidencias',
  },
  {
    number: '03',
    title: 'Logística inversa',
    description: 'Devoluciones trazables, desde la aprobación y recogida hasta la inspección y reacondicionamiento.',
    detail: 'Reglas · Recogida · Clasificación',
  },
  {
    number: '04',
    title: 'Atención al cliente inteligente',
    description: 'Respuestas de seguimiento y estado de devoluciones para clientes B2B y consumidores B2C.',
    detail: '24/7 · Bilingüe · Escalado humano',
  },
];

/** Presenta las soluciones logísticas principales de TrackFlow. */
export function ServiceGrid(): React.ReactElement {
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
      {services.map((service) => (
        <article className="group flex min-h-80 flex-col rounded-xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-emerald-200 hover:shadow-lg" key={service.number}>
          <span className="text-sm font-bold text-emerald-500">{service.number}</span>
          <h3 className="mt-8 text-xl font-bold text-slate-900">{service.title}</h3>
          <p className="mt-4 leading-7 text-slate-600">{service.description}</p>
          <span className="mt-auto border-t border-slate-100 pt-5 text-xs font-medium text-slate-500">{service.detail}</span>
        </article>
      ))}
    </div>
  );
}
