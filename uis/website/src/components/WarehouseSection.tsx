const warehouses = [
  {
    code: 'US-LAX',
    city: 'Los Ángeles',
    description: 'Nuestro origen y puerta de entrada al mercado estadounidense. Operación de almacén y última milla conectada con los principales carriers.',
    image: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=1200&q=85',
  },
  {
    code: 'ES-ZAZ',
    city: 'Zaragoza',
    description: 'Hub ibérico y sede de TrackFlow Tech. Tecnología y operación se unen para servir rutas nacionales y transfronterizas.',
    image: 'https://images.unsplash.com/photo-1565793298595-6a879b1d9492?auto=format&fit=crop&w=1200&q=85',
  },
];

/** Presenta los dos centros logísticos de la red TrackFlow. */
export function WarehouseSection(): React.ReactElement {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {warehouses.map((warehouse) => (
        <article className="group relative min-h-[28rem] overflow-hidden rounded-2xl bg-slate-900 shadow-xl" key={warehouse.code}>
          <img className="absolute inset-0 h-full w-full object-cover opacity-70 transition duration-700 group-hover:scale-105" src={warehouse.image} alt={`Operación logística en ${warehouse.city}`} />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/40 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-7 text-white sm:p-9">
            <span className="inline-flex rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold text-white backdrop-blur">{warehouse.code}</span>
            <h3 className="mt-4 text-3xl font-bold sm:text-4xl">{warehouse.city}</h3>
            <p className="mt-3 max-w-xl leading-7 text-slate-200">{warehouse.description}</p>
          </div>
        </article>
      ))}
    </div>
  );
}
