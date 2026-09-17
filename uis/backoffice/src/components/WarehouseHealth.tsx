const warehouses = [
  {
    location: 'Los Ángeles',
    country: 'US',
    system: 'SGA comercial',
    connection: 'Integración pendiente',
    teams: '~35 operarios',
  },
  {
    location: 'Zaragoza',
    country: 'ES',
    system: 'Spreadsheet avanzado',
    connection: 'Integración pendiente',
    teams: '~35 operarios · Sede de TrackFlow Tech',
  },
];

/** Resume el estado tecnológico de los almacenes de TrackFlow. */
export function WarehouseHealth(): React.ReactElement {
  return (
    <section id="almacenes" className="scroll-mt-6 pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div><span className="text-xs font-bold uppercase text-emerald-600">Infraestructura</span><h2 className="mt-1 text-xl font-bold text-slate-900">Estado de almacenes</h2></div>
        <span className="w-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">Visión global no disponible</span>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {warehouses.map((warehouse) => (
          <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 shadow-sm" key={warehouse.country}>
            <div className="flex items-start justify-between gap-4">
              <div><span className="text-xs font-bold text-emerald-700">{warehouse.country}</span><h3 className="mt-1 text-xl font-bold text-slate-900">{warehouse.location}</h3></div>
              <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-xs font-semibold text-emerald-700"><i className="h-2 w-2 rounded-full bg-emerald-500" />Operativo</span>
            </div>
            <p className="mt-5 text-sm text-slate-600">{warehouse.teams}</p>
            <div className="mt-5 rounded-lg border border-emerald-100 bg-white/80 p-4">
              <span className="text-xs text-slate-500">Sistema actual</span>
              <strong className="mt-1 block text-sm text-slate-900">{warehouse.system}</strong>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs font-semibold text-amber-700"><i className="h-2 w-2 rounded-full bg-amber-500" />{warehouse.connection}</div>
          </article>
        ))}
      </div>
    </section>
  );
}
