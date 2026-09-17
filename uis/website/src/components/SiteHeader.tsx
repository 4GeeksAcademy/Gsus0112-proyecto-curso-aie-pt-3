const navigation = [
  { label: 'Soluciones', href: '#soluciones' },
  { label: 'Red logística', href: '#red' },
  { label: 'Contacto', href: '#contacto' },
];

/** Renderiza la navegación principal de la web pública. */
export function SiteHeader(): React.ReactElement {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-lg">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <a className="text-xl font-extrabold text-emerald-700" href="#inicio" aria-label="TrackFlow, inicio">
          TrackFlow
        </a>
        <nav className="hidden items-center gap-8 text-sm font-medium text-slate-600 md:flex" aria-label="Navegación principal">
          {navigation.map((item) => (
            <a className="transition-colors hover:text-emerald-600" href={item.href} key={item.href}>{item.label}</a>
          ))}
        </nav>
        <a className="rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2" href="#contacto">
          Empezar
        </a>
      </div>
    </header>
  );
}
