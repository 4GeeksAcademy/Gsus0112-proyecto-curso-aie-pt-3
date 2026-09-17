/** Renderiza el cierre corporativo y los datos de contacto. */
export function SiteFooter(): React.ReactElement {
  return (
    <footer id="contacto" className="bg-slate-900 text-white">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <div className="grid gap-10 border-b border-slate-800 pb-12 md:grid-cols-2 md:items-end">
          <div>
            <strong className="text-2xl font-extrabold text-emerald-400">TrackFlow</strong>
            <p className="mt-5 max-w-xl text-2xl font-semibold leading-snug sm:text-3xl">De la estantería a la puerta. Y de vuelta, cuando haga falta.</p>
          </div>
          <div className="md:text-right">
            <p className="text-slate-300">Operaciones en Los Ángeles y Zaragoza</p>
            <a className="mt-3 inline-block font-medium text-emerald-400 transition hover:text-emerald-300" href="mailto:operations@trackflow.com">operations@trackflow.com</a>
          </div>
        </div>
        <div className="flex flex-col gap-2 pt-7 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Logística de última milla desde 2009</span>
          <span>© 2026 TrackFlow. Todos los derechos reservados.</span>
        </div>
      </div>
    </footer>
  );
}
