const departments = [
  { area: 'Warehouse Operations', owner: 'Ana Whitfield', team: '~70 operarios + 2 managers', status: 'Necesita mejora' },
  { area: 'Last Mile', owner: 'Carlos Vega', team: '6 coordinadores', status: 'Necesita mejora' },
  { area: 'Reverse Logistics', owner: 'Sofía Ramos', team: '5 personas', status: 'Necesita mejora' },
  { area: 'Customer Experience', owner: 'Valentina Cruz', team: '15 agentes', status: 'Necesita mejora' },
  { area: 'Commercial', owner: 'Miguel Torres', team: '4 account managers + 4 BD', status: 'Operativo' },
  { area: 'Technology', owner: 'Andrés Kim', team: '7 personas', status: 'Operativo' },
  { area: 'Executive', owner: 'Thomas Harry', team: 'Dirección', status: 'Operativo' },
];

/** Muestra las prioridades operativas y sus responsables. */
export function OperationsPanel(): React.ReactElement {
  return (
    <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <span className="text-xs font-bold uppercase text-emerald-600">TrackFlow Tech</span>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Estado de Departamentos</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500"><tr><th className="px-6 py-3 font-semibold">Departamento</th><th className="px-6 py-3 font-semibold">Responsable</th><th className="px-6 py-3 font-semibold">Equipo</th><th className="px-6 py-3 font-semibold">Estado</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {departments.map((department) => (
              <tr className="transition hover:bg-slate-50" key={department.area}>
                <td className="whitespace-nowrap px-6 py-4 font-semibold text-slate-900">{department.area}</td>
                <td className="whitespace-nowrap px-6 py-4 text-slate-600">{department.owner}</td>
                <td className="whitespace-nowrap px-6 py-4 text-slate-600">{department.team}</td>
                <td className="whitespace-nowrap px-6 py-4"><span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${department.status === 'Operativo' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}`}>{department.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
