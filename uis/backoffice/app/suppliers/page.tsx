'use client';

import { useEffect, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import { AuthGuard } from '@/src/components/AuthGuard';
import { Sidebar } from '@/src/components/Sidebar';
import { fetchWithAuth } from '@/src/utils/api';

type Supplier = {
  id: number;
  name: string;
  country: string;
  categories: string[];
  rate_per_shipment: number;
  currency: string;
  service_zone: string;
  contact_email: string;
  notes: string | null;
  status: 'active' | 'suspended';
};

const fields = [
  { name: 'name', label: 'Nombre', type: 'text' },
  { name: 'country', label: 'País', type: 'text' },
  { name: 'categories', label: 'Categorías (separadas por coma)', type: 'text' },
  { name: 'rate_per_shipment', label: 'Tarifa por envío', type: 'number' },
  { name: 'currency', label: 'Moneda', type: 'text' },
  { name: 'service_zone', label: 'Zona de servicio', type: 'text' },
  { name: 'contact_email', label: 'Email de contacto', type: 'email' },
  { name: 'notes', label: 'Notas', type: 'text' },
] as const;

const inputClass = 'w-full min-w-0 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm';
const buttonClass = 'rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-emerald-50 disabled:opacity-50';

async function apiRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetchWithAuth(`/api/suppliers${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init.headers },
  });
  if (!response.ok) {
    const body: { detail?: string | { loc: (string | number)[]; msg: string }[] } =
      await response.json().catch(() => ({}));
    const detail = Array.isArray(body.detail)
      ? body.detail.map((item) => `${item.loc.slice(1).join('.')}: ${item.msg}`).join('; ')
      : body.detail ?? 'La solicitud no pudo completarse.';
    throw new Error(`Error ${response.status}: ${detail}`);
  }
  return response;
}

function SupplierDirectory(): ReactElement {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [query, setQuery] = useState('');
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    setError(null);
    void apiRequest(query, { signal: controller.signal })
      .then((response) => response.json() as Promise<Supplier[]>)
      .then((data) => { if (!controller.signal.aborted) setSuppliers(data); })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setLoadFailed(true);
          setError(reason instanceof Error ? reason.message : 'No se pudo conectar con la API.');
        }
      })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [query, reload]);

  async function mutate(path: string, method: string, body?: unknown): Promise<boolean> {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(path, { method, body: body === undefined ? null : JSON.stringify(body) });
      setSuccess(method === 'DELETE' ? 'Proveedor eliminado.' : 'Cambios guardados.');
      setReload((value) => value + 1);
      return true;
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'No se pudo conectar con la API.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function createSupplier(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const text = (name: string): string => String(data.get(name) ?? '').trim();
    const saved = await mutate('', 'POST', {
      name: text('name'),
      country: text('country').toUpperCase(),
      categories: text('categories').split(',').map((category) => category.trim()).filter(Boolean),
      rate_per_shipment: Number(text('rate_per_shipment')),
      currency: text('currency').toUpperCase(),
      service_zone: text('service_zone'),
      contact_email: text('contact_email'),
      notes: text('notes') || null,
      status: 'active',
    });
    if (saved) form.reset();
  }

  function filterSuppliers(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const filters = new URLSearchParams();
    const country = String(data.get('country') ?? '').trim().toUpperCase();
    const category = String(data.get('category') ?? '').trim();
    if (country) filters.set('country', country);
    if (category) filters.set('category', category);
    setQuery(filters.size > 0 ? `?${filters}` : '');
    setReload((value) => value + 1);
  }

  return (
    <div className="min-h-screen bg-slate-50 md:pl-64">
      <Sidebar />
      <main className="mx-auto min-w-0 max-w-7xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">Directorio de Proveedores</h1>
        {error && <p role="alert" className="mb-4 border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {success && <p role="status" className="mb-4 border-l-4 border-emerald-600 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}

        <section className="border-y border-slate-200 py-6" aria-labelledby="new-supplier-heading">
          <h2 id="new-supplier-heading" className="mb-4 text-lg font-semibold">Nuevo proveedor</h2>
          <form onSubmit={createSupplier}>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {fields.map((field) => (
                <div key={field.name} className="min-w-0">
                  <label htmlFor={`supplier-${field.name}`} className="mb-1 block text-sm font-medium">{field.label}</label>
                  <input id={`supplier-${field.name}`} name={field.name} type={field.type}
                    required={field.name !== 'notes'} className={inputClass}
                    min={field.type === 'number' ? '0.00000001' : undefined}
                    step={field.type === 'number' ? 'any' : undefined} />
                </div>
              ))}
            </div>
            <button disabled={saving} className={`${buttonClass} mt-4 bg-emerald-600 text-white`} type="submit">Crear proveedor</button>
          </form>
        </section>

        <form onSubmit={filterSuppliers} onReset={() => { setQuery(''); setReload((value) => value + 1); }}
          className="flex flex-wrap items-end gap-3 border-b border-slate-200 py-5">
          <div><label htmlFor="filter-country" className="mb-1 block text-sm">País</label><input id="filter-country" name="country" className={inputClass} /></div>
          <div><label htmlFor="filter-category" className="mb-1 block text-sm">Categoría</label><input id="filter-category" name="category" className={inputClass} /></div>
          <button className={buttonClass} type="submit">Filtrar</button>
          <button className={buttonClass} type="reset" title="Limpiar filtros" aria-label="Limpiar filtros">&#215;</button>
          <button className={buttonClass} type="button" title="Recargar proveedores" aria-label="Recargar proveedores" onClick={() => setReload((value) => value + 1)}>&#8635;</button>
        </form>

        <section className="py-6" aria-labelledby="suppliers-heading">
          <h2 id="suppliers-heading" className="mb-4 text-lg font-semibold">Proveedores</h2>
          <div className="overflow-x-auto" role="region" aria-label="Tabla de proveedores" aria-busy={loading} tabIndex={0}>
            <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
              <thead className="bg-slate-100 text-slate-600"><tr>
                {['Proveedor', 'País', 'Categorías', 'Tarifa por envío', 'Zona de servicio', 'Contacto', 'Notas', 'Estado', 'Acciones'].map((heading) => <th key={heading} scope="col" className="p-3">{heading}</th>)}
              </tr></thead>
              <tbody>
                {loading || loadFailed || suppliers.length === 0 ? (
                  <tr><td colSpan={9} className="p-8 text-center text-slate-500">{loading ? 'Cargando proveedores...' : loadFailed ? 'No se pudieron cargar los proveedores.' : 'No hay proveedores para estos filtros.'}</td></tr>
                ) : suppliers.map((supplier) => (
                  <tr key={supplier.id} className="border-b border-slate-200 align-top">
                    <td className="max-w-48 break-words p-3 font-medium">{supplier.name}</td>
                    <td className="p-3">{supplier.country}</td>
                    <td className="max-w-40 break-words p-3">{supplier.categories.join(', ')}</td>
                    <td className="p-3">
                      <form className="flex items-center gap-2" onSubmit={(event) => {
                        event.preventDefault();
                        const data = new FormData(event.currentTarget);
                        void mutate(`/${supplier.id}/rate`, 'PATCH', { rate_per_shipment: Number(data.get('rate_per_shipment')) });
                      }}>
                        <input key={supplier.rate_per_shipment} aria-label={`Tarifa de ${supplier.name}`} name="rate_per_shipment" type="number" min="0.00000001" step="any" required defaultValue={supplier.rate_per_shipment} className={`${inputClass} w-24`} />
                        <span>{supplier.currency}</span>
                        <button disabled={saving} className={buttonClass} title="Guardar tarifa" aria-label={`Guardar tarifa de ${supplier.name}`}>&#10003;</button>
                      </form>
                    </td>
                    <td className="max-w-40 break-words p-3">{supplier.service_zone}</td>
                    <td className="max-w-56 break-words p-3"><a className="text-emerald-700 underline" href={`mailto:${supplier.contact_email}`}>{supplier.contact_email}</a></td>
                    <td className="max-w-48 break-words p-3">{supplier.notes ?? '-'}</td>
                    <td className="p-3">{supplier.status === 'active' ? 'Activo' : 'Suspendido'}</td>
                    <td className="p-3"><div className="flex gap-2">
                      <button disabled={saving} className={buttonClass} title={supplier.status === 'active' ? 'Suspender proveedor' : 'Activar proveedor'} onClick={() => void mutate(`/${supplier.id}/status`, 'PATCH', { status: supplier.status === 'active' ? 'suspended' : 'active' })}>{supplier.status === 'active' ? 'Suspender' : 'Activar'}</button>
                      <button disabled={saving} className={`${buttonClass} text-red-700`} onClick={() => {
                        if (window.confirm(`¿Eliminar a ${supplier.name}?`)) void mutate(`/${supplier.id}`, 'DELETE');
                      }}>Eliminar</button>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}

/** Muestra el directorio de proveedores solo a usuarios autenticados. */
export default function SuppliersPage(): ReactElement {
  return <AuthGuard><SupplierDirectory /></AuthGuard>;
}