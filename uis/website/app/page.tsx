import { ServiceGrid } from '@/src/components/ServiceGrid';
import { SiteFooter } from '@/src/components/SiteFooter';
import { SiteHeader } from '@/src/components/SiteHeader';
import { WarehouseSection } from '@/src/components/WarehouseSection';

const metrics = [
  { value: '130', label: 'personas' },
  { value: '2', label: 'países' },
  { value: '8', label: 'transportistas' },
  { value: '€9M', label: 'facturación anual' },
];

/** Renderiza la página corporativa principal de TrackFlow. */
export default function HomePage(): React.ReactElement {
  return (
    <main id="inicio">
      <SiteHeader />
      <section className="relative isolate overflow-hidden bg-slate-900 text-white">
        <img className="absolute inset-0 -z-20 h-full w-full object-cover opacity-35" src="https://images.unsplash.com/photo-1580674285054-bed31e145f59?auto=format&fit=crop&w=2000&q=90" alt="" />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-slate-950 via-slate-900/90 to-emerald-950/30" />
        <div className="mx-auto flex min-h-[38rem] w-full max-w-7xl items-center px-4 py-20 sm:px-6 lg:min-h-[43rem] lg:px-8 lg:py-28">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">US ↔ España · Desde 2009</span>
            <h1 className="mt-7 text-4xl font-extrabold leading-tight sm:text-5xl lg:text-6xl">Unifica tu inventario y escala tus envíos sin fricción</h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200 sm:text-xl">Logística de última milla que conecta tu inventario con cada puerta, sin perder el control por el camino.</p>
            <a className="mt-8 inline-flex items-center gap-3 rounded-lg bg-emerald-500 px-6 py-3.5 font-semibold text-white shadow-lg shadow-emerald-950/30 transition hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-300 focus:ring-offset-2 focus:ring-offset-slate-900" href="#soluciones">
              Explorar soluciones <span aria-hidden="true">→</span>
            </a>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-10 w-full max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Cifras clave de TrackFlow">
        <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl shadow-slate-900/10 lg:grid-cols-4">
          {metrics.map((metric) => (
            <div className="border-b border-r border-slate-100 p-6 text-center last:border-r-0 sm:p-8 lg:border-b-0" key={metric.label}>
              <strong className="block text-4xl font-extrabold text-emerald-600">{metric.value}</strong>
              <span className="mt-2 block text-sm text-slate-500">{metric.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="soluciones" className="bg-white py-20 sm:py-24 lg:py-32">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-sm font-bold uppercase text-emerald-600">Operación conectada</span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">La infraestructura que tu e-commerce necesita</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">Gestionamos la complejidad física y digital para que las marcas puedan concentrarse en crecer.</p>
          </div>
          <div className="mt-12">
            <ServiceGrid />
          </div>
        </div>
      </section>

      <section id="red" className="bg-slate-50 py-20 sm:py-24 lg:py-32">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <span className="text-sm font-bold uppercase text-emerald-600">Dos mercados, una operación</span>
            <h2 className="mt-3 text-3xl font-extrabold text-slate-900 sm:text-4xl">Almacenes a ambos lados del Atlántico</h2>
            <p className="mt-5 text-lg leading-8 text-slate-600">Coordinamos inventario, pedidos, entregas y devoluciones con equipos locales y una visión global.</p>
          </div>
          <div className="mt-12">
            <WarehouseSection />
          </div>
        </div>
      </section>

      <section id="compania" className="bg-emerald-700 py-16 text-white sm:py-20">
        <div className="mx-auto grid w-full max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-[12rem_1fr] lg:px-8">
          <span className="text-sm font-bold uppercase text-emerald-200">TrackFlow Tech</span>
          <p className="max-w-4xl text-2xl font-semibold leading-snug sm:text-3xl">Convertimos sistemas fragmentados y procesos manuales en una operación logística visible, automatizada y preparada para funcionar 24/7.</p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
