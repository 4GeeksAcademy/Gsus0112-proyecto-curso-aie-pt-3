'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import {
  InventoryShell,
  StockLevelBadge,
  WarehouseBadge,
} from '@/src/components/InventoryShell';
import {
  CATEGORY_LABELS,
  CRITICAL_STOCK_THRESHOLD,
  LOW_STOCK_THRESHOLD,
  WAREHOUSE_LABELS,
  classifyStockLevel,
  createInventoryProduct,
  fetchInventoryProducts,
} from '@/src/lib/inventory';
import type { SKUCategory, SKUItem, WarehouseCode } from '@/src/lib/inventory';

/**
 * Umbrales de nivel de stock aplicados en el catálogo de TrackFlow:
 * - Crítico (`critical`): `current_stock <= 10` unidades -> Indicador rojo (`🔴 Stock crítico` / `Sin stock`).
 * - Bajo (`low`): `11 <= current_stock <= 50` unidades -> Indicador ámbar (`🟡 Stock bajo`).
 * - Saludable (`healthy`): `current_stock > 50` unidades -> Indicador esmeralda (`🟢 Stock saludable`).
 */
export default function InventoryProductsPage(): ReactElement {
  const [products, setProducts] = useState<SKUItem[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState<WarehouseCode | 'ALL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<SKUCategory | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [newSku, setNewSku] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newCategory, setNewCategory] = useState<SKUCategory>('fashion');
  const [newWarehouse, setNewWarehouse] = useState<WarehouseCode>('LA');

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const selectedWarehouse = warehouseFilter === 'ALL' ? undefined : warehouseFilter;
    void fetchInventoryProducts(selectedWarehouse, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setProducts(data);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el catálogo de SKUs desde la API de inventario.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [warehouseFilter, reloadKey]);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return products.filter((item) => {
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return (
        item.name.toLowerCase().includes(normalizedSearch) ||
        item.sku.toLowerCase().includes(normalizedSearch) ||
        item.client_name.toLowerCase().includes(normalizedSearch)
      );
    });
  }, [products, categoryFilter, searchQuery]);

  const metrics = useMemo(() => {
    let healthyCount = 0;
    let lowCount = 0;
    let criticalCount = 0;

    for (const item of products) {
      const level = classifyStockLevel(item.current_stock).status;
      if (level === 'healthy') healthyCount += 1;
      else if (level === 'low') lowCount += 1;
      else criticalCount += 1;
    }
    return {
      totalSkus: products.length,
      healthyCount,
      lowCount,
      criticalCount,
    };
  }, [products]);

  async function handleCreateProduct(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setCreating(true);
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const created = await createInventoryProduct({
        name: newName.trim(),
        sku: newSku.trim().toUpperCase(),
        client_name: newClientName.trim(),
        category: newCategory,
        warehouse: newWarehouse,
      });
      setCreateSuccess(
        `SKU "${created.sku}" (${created.name}) registrado en ${created.warehouse} con stock inicial 0.`,
      );
      setNewName('');
      setNewSku('');
      setNewClientName('');
      setShowCreateForm(false);
      setReloadKey((prev) => prev + 1);
    } catch (err: unknown) {
      setCreateError(
        err instanceof Error
          ? err.message
          : 'No fue posible registrar el nuevo SKU. Inténtalo nuevamente.',
      );
    } finally {
      setCreating(false);
    }
  }

  return (
    <InventoryShell
      title="Catálogo de SKUs y Estado de Stock por Almacén"
      subtitle="Visibilidad en tiempo real del stock neto (entradas − salidas) por SKU y sede operativa (Los Ángeles LA y Zaragoza ZGZ)."
    >
      {/* Indicadores de salud de inventario y leyenda de umbrales */}
      <section
        aria-label="Resumen de niveles de stock"
        className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total SKUs en vista
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{metrics.totalSkus}</p>
          <p className="mt-1 text-xs text-slate-500">Almacenes LA y ZGZ separados (Regla 6)</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            🟢 Stock saludable (&gt; {LOW_STOCK_THRESHOLD} uds.)
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900">{metrics.healthyCount}</p>
          <p className="mt-1 text-xs text-emerald-700">Cobertura normal para picking</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            🟡 Stock bajo ({CRITICAL_STOCK_THRESHOLD + 1}–{LOW_STOCK_THRESHOLD} uds.)
          </p>
          <p className="mt-1 text-2xl font-extrabold text-amber-950">{metrics.lowCount}</p>
          <p className="mt-1 text-xs text-amber-800">Planificar orden de entrada con cliente</p>
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-800">
            🔴 Stock crítico (≤ {CRITICAL_STOCK_THRESHOLD} uds.)
          </p>
          <p className="mt-1 text-2xl font-extrabold text-red-900">{metrics.criticalCount}</p>
          <p className="mt-1 text-xs text-red-700">Riesgo de rotura de stock en almacén</p>
        </div>
      </section>

      {error && (
        <div
          role="alert"
          className="mb-6 rounded-xl border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900 shadow-xs"
        >
          <p className="font-semibold">{error}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setReloadKey((prev) => prev + 1)}
              className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700"
            >
              Reintentar carga
            </button>
            <Link
              href="/"
              className="text-xs font-semibold text-red-800 underline hover:text-red-950"
            >
              Volver al Centro de Control
            </Link>
          </div>
        </div>
      )}

      {createSuccess && (
        <div
          role="status"
          className="mb-6 rounded-xl border-l-4 border-emerald-600 bg-emerald-50 p-4 text-sm text-emerald-900 shadow-xs"
        >
          <p className="font-semibold">{createSuccess}</p>
        </div>
      )}

      {/* Barra de filtros y alta de nuevo SKU */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="filter-warehouse"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Almacén (`warehouse`)
              </label>
              <select
                id="filter-warehouse"
                value={warehouseFilter}
                onChange={(e) => setWarehouseFilter(e.target.value as WarehouseCode | 'ALL')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="ALL">Todos los almacenes (LA + ZGZ)</option>
                <option value="LA">{WAREHOUSE_LABELS.LA}</option>
                <option value="ZGZ">{WAREHOUSE_LABELS.ZGZ}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="filter-category"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Categoría (`category`)
              </label>
              <select
                id="filter-category"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value as SKUCategory | 'ALL')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="ALL">Todas las categorías</option>
                <option value="fashion">{CATEGORY_LABELS.fashion}</option>
                <option value="electronics">{CATEGORY_LABELS.electronics}</option>
                <option value="cosmetics">{CATEGORY_LABELS.cosmetics}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="search-sku"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Buscar por nombre, código SKU o marca cliente
              </label>
              <input
                id="search-sku"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej. CLT-SNK-W-42, PureStep, Auriculares..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setReloadKey((prev) => prev + 1)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              ↻ Actualizar stock
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm((prev) => !prev);
                setCreateError(null);
              }}
              className="rounded-lg bg-slate-900 px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              {showCreateForm ? 'Cerrar formulario de SKU' : '+ Nuevo SKU en catálogo'}
            </button>
          </div>
        </div>

        {showCreateForm && (
          <form
            onSubmit={handleCreateProduct}
            className="mt-5 border-t border-slate-200 pt-5"
            aria-label="Formulario para registrar nuevo SKU"
          >
            <h2 className="mb-3 text-sm font-bold text-slate-900">
              Registrar nuevo SKU (`POST /inventory/products` — inicia con `current_stock = 0`)
            </h2>
            {createError && (
              <div
                role="alert"
                className="mb-4 rounded-lg border-l-4 border-red-600 bg-red-50 p-3 text-xs font-semibold text-red-800"
              >
                {createError}
              </div>
            )}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <div>
                <label htmlFor="new-sku-name" className="mb-1 block text-xs font-medium text-slate-700">
                  Nombre del producto (`name`)
                </label>
                <input
                  id="new-sku-name"
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Chaqueta impermeable M"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label htmlFor="new-sku-code" className="mb-1 block text-xs font-medium text-slate-700">
                  Código SKU (`sku`)
                </label>
                <input
                  id="new-sku-code"
                  type="text"
                  required
                  value={newSku}
                  onChange={(e) => setNewSku(e.target.value)}
                  placeholder="Ej. CLT-JKT-M-01"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="new-sku-client"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Marca cliente (`client_name`)
                </label>
                <input
                  id="new-sku-client"
                  type="text"
                  required
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder="Ej. UrbanThread"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label
                  htmlFor="new-sku-category"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Categoría (`category`)
                </label>
                <select
                  id="new-sku-category"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as SKUCategory)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="fashion">{CATEGORY_LABELS.fashion}</option>
                  <option value="electronics">{CATEGORY_LABELS.electronics}</option>
                  <option value="cosmetics">{CATEGORY_LABELS.cosmetics}</option>
                </select>
              </div>
              <div>
                <label
                  htmlFor="new-sku-warehouse"
                  className="mb-1 block text-xs font-medium text-slate-700"
                >
                  Almacén (`warehouse`)
                </label>
                <select
                  id="new-sku-warehouse"
                  value={newWarehouse}
                  onChange={(e) => setNewWarehouse(e.target.value as WarehouseCode)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="LA">{WAREHOUSE_LABELS.LA}</option>
                  <option value="ZGZ">{WAREHOUSE_LABELS.ZGZ}</option>
                </select>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {creating ? 'Guardando SKU...' : 'Guardar SKU en catálogo'}
              </button>
            </div>
          </form>
        )}
      </section>

      {/* Tabla principal de SKUs */}
      <section
        aria-label="Listado de SKUs en inventario"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
      >
        <div className="overflow-x-auto" role="region" aria-busy={loading} tabIndex={0}>
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="p-3.5">Código SKU (`sku`)</th>
                <th scope="col" className="p-3.5">Producto (`name`)</th>
                <th scope="col" className="p-3.5">Marca Cliente (`client_name`)</th>
                <th scope="col" className="p-3.5">Categoría (`category`)</th>
                <th scope="col" className="p-3.5">Almacén (`warehouse`)</th>
                <th scope="col" className="p-3.5">Stock Actual (`current_stock`)</th>
                <th scope="col" className="p-3.5">Acciones de Orden</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    Cargando catálogo de SKUs y calculando stock en tiempo real...
                  </td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    No se encontraron SKUs para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-50/80">
                    <td className="p-3.5 font-mono text-xs font-bold text-slate-900">
                      {product.sku}
                    </td>
                    <td className="p-3.5 font-semibold text-slate-900">{product.name}</td>
                    <td className="p-3.5 text-slate-700">{product.client_name}</td>
                    <td className="p-3.5">
                      <span className="inline-flex rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                        {CATEGORY_LABELS[product.category] ?? product.category}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <WarehouseBadge warehouse={product.warehouse} />
                    </td>
                    <td className="p-3.5">
                      <StockLevelBadge currentStock={product.current_stock} />
                    </td>
                    <td className="p-3.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/backoffice/inventory/orders/inbound?sku_id=${product.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100"
                        >
                          📥 Crear orden de entrada
                        </Link>
                        <Link
                          href={`/backoffice/inventory/orders/outbound?sku_id=${product.id}`}
                          className="inline-flex items-center gap-1 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-xs font-semibold text-amber-900 transition hover:bg-amber-100"
                        >
                          📤 Crear orden de salida
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </InventoryShell>
  );
}
