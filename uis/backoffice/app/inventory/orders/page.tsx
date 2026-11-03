'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';

import { InventoryShell, WarehouseBadge } from '@/src/components/InventoryShell';
import {
  CATEGORY_LABELS,
  EXIT_TYPE_LABELS,
  WAREHOUSE_LABELS,
  fetchInventoryOrders,
} from '@/src/lib/inventory';
import type { OrderMovementType, StockOrderItem, WarehouseCode } from '@/src/lib/inventory';

function formatOrderTimestamp(isoString: string): string {
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return isoString;
  }
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}

export default function InventoryOrdersHistoryPage(): ReactElement {
  const [orders, setOrders] = useState<StockOrderItem[]>([]);
  const [warehouseFilter, setWarehouseFilter] = useState<WarehouseCode | 'ALL'>('ALL');
  const [movementFilter, setMovementFilter] = useState<OrderMovementType | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const selectedWarehouse = warehouseFilter === 'ALL' ? undefined : warehouseFilter;
    void fetchInventoryOrders(selectedWarehouse, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) {
          setOrders(data);
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo obtener el historial de órdenes desde la API.',
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

  const filteredOrders = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    return orders.filter((order) => {
      if (movementFilter !== 'ALL' && order.order_type !== movementFilter) {
        return false;
      }
      if (!normalizedSearch) {
        return true;
      }
      return (
        order.sku.name.toLowerCase().includes(normalizedSearch) ||
        order.sku.sku.toLowerCase().includes(normalizedSearch) ||
        order.sku.client_name.toLowerCase().includes(normalizedSearch) ||
        order.user_uuid.toLowerCase().includes(normalizedSearch) ||
        (order.reference?.toLowerCase().includes(normalizedSearch) ?? false) ||
        (order.tracking_number?.toLowerCase().includes(normalizedSearch) ?? false)
      );
    });
  }, [orders, movementFilter, searchQuery]);

  const summary = useMemo(() => {
    let inboundCount = 0;
    let outboundCount = 0;
    let totalUnitsIn = 0;
    let totalUnitsOut = 0;

    for (const order of orders) {
      if (order.order_type === 'inbound') {
        inboundCount += 1;
        totalUnitsIn += order.quantity;
      } else {
        outboundCount += 1;
        totalUnitsOut += order.quantity;
      }
    }
    return {
      totalOrders: orders.length,
      inboundCount,
      outboundCount,
      totalUnitsIn,
      totalUnitsOut,
    };
  }, [orders]);

  return (
    <InventoryShell
      title="Historial Consolidado de Órdenes de Inventario (Sólo Lectura)"
      subtitle="Registro auditable e inmutable de todas las recepciones (`StockEntry`) y salidas (`StockExit`) con trazabilidad de usuario (`user_uuid`)."
    >
      {/* Resumen de auditoría */}
      <section
        aria-label="Resumen de movimientos de inventario"
        className="mb-6 grid gap-4 sm:grid-cols-3"
      >
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Total de Órdenes Registradas
          </p>
          <p className="mt-1 text-2xl font-extrabold text-slate-900">{summary.totalOrders}</p>
          <p className="mt-1 text-xs text-slate-500">Registro histórico inmutable (sólo lectura)</p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
            📥 Órdenes de Entrada (`StockEntry`)
          </p>
          <p className="mt-1 text-2xl font-extrabold text-emerald-900">
            {summary.inboundCount}{' '}
            <span className="text-sm font-semibold text-emerald-700">
              (+{summary.totalUnitsIn} uds.)
            </span>
          </p>
          <p className="mt-1 text-xs text-emerald-700">Recepciones desde marcas cliente</p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 shadow-xs">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
            📤 Órdenes de Salida (`StockExit`)
          </p>
          <p className="mt-1 text-2xl font-extrabold text-amber-950">
            {summary.outboundCount}{' '}
            <span className="text-sm font-semibold text-amber-800">
              (-{summary.totalUnitsOut} uds.)
            </span>
          </p>
          <p className="mt-1 text-xs text-amber-800">Despachos (`dispatch`) y pérdidas (`loss`)</p>
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
              className="rounded-lg bg-red-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Reintentar carga
            </button>
            <Link
              href="/backoffice/inventory/products"
              className="text-xs font-semibold text-red-800 underline hover:text-red-950"
            >
              Volver al catálogo de SKUs
            </Link>
          </div>
        </div>
      )}

      {/* Filtros de consulta */}
      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            <div>
              <label
                htmlFor="orders-filter-type"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Tipo de orden (`order_type`)
              </label>
              <select
                id="orders-filter-type"
                value={movementFilter}
                onChange={(e) => setMovementFilter(e.target.value as OrderMovementType | 'ALL')}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                <option value="ALL">Todas (Entradas + Salidas)</option>
                <option value="inbound">📥 Sólo Entradas (`StockEntry`)</option>
                <option value="outbound">📤 Sólo Salidas (`StockExit`)</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="orders-filter-warehouse"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Almacén (`warehouse`)
              </label>
              <select
                id="orders-filter-warehouse"
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
                htmlFor="orders-search"
                className="mb-1 block text-xs font-semibold text-slate-700"
              >
                Buscar por producto, SKU, referencia, tracking o `user_uuid`
              </label>
              <input
                id="orders-search"
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Ej. PO-2024-0098, 1Z999, CLT-SNK..."
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setReloadKey((prev) => prev + 1)}
            className="self-start rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 lg:self-auto"
          >
            ↻ Actualizar historial
          </button>
        </div>
      </section>

      {/* Tabla de sólo lectura */}
      <section
        aria-label="Tabla de historial de órdenes de inventario"
        className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs"
      >
        <div className="overflow-x-auto" role="region" aria-busy={loading} tabIndex={0}>
          <table className="w-full min-w-[1050px] border-collapse text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-100 text-xs font-bold uppercase tracking-wider text-slate-600">
              <tr>
                <th scope="col" className="p-3.5">Tipo de Orden</th>
                <th scope="col" className="p-3.5">Producto (`sku.name` / `sku`)</th>
                <th scope="col" className="p-3.5">Almacén (`warehouse`)</th>
                <th scope="col" className="p-3.5">Cantidad (`quantity`)</th>
                <th scope="col" className="p-3.5">Referencia / Tracking</th>
                <th scope="col" className="p-3.5">Fecha (`created_at`)</th>
                <th scope="col" className="p-3.5">Creado por (`user_uuid`)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    Cargando historial de órdenes desde `GET /inventory/orders`...
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-slate-500">
                    No hay órdenes registradas para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => {
                  const isInbound = order.order_type === 'inbound';
                  return (
                    <tr
                      key={`${order.order_type}-${order.id}`}
                      className="hover:bg-slate-50/80"
                    >
                      <td className="p-3.5">
                        {isInbound ? (
                          <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800">
                            <span aria-hidden="true">📥</span>
                            <span>Entrada (`StockEntry`)</span>
                          </span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${
                              order.exit_type === 'loss'
                                ? 'border-red-300 bg-red-50 text-red-800'
                                : 'border-amber-300 bg-amber-50 text-amber-900'
                            }`}
                          >
                            <span aria-hidden="true">
                              {order.exit_type === 'loss' ? '⚠️' : '📤'}
                            </span>
                            <span>
                              Salida (`StockExit` · {order.exit_type ?? 'dispatch'})
                            </span>
                          </span>
                        )}
                      </td>

                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{order.sku.name}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                          <code className="font-mono font-bold text-slate-700">
                            {order.sku.sku}
                          </code>
                          <span>·</span>
                          <span>{order.sku.client_name}</span>
                          <span>·</span>
                          <span>{CATEGORY_LABELS[order.sku.category] ?? order.sku.category}</span>
                        </div>
                      </td>

                      <td className="p-3.5">
                        <WarehouseBadge warehouse={order.warehouse} />
                      </td>

                      <td className="p-3.5">
                        <span
                          className={`inline-flex rounded-md px-2.5 py-1 font-mono text-xs font-extrabold ${
                            isInbound
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-amber-100 text-amber-950'
                          }`}
                        >
                          {isInbound ? `+${order.quantity}` : `-${order.quantity}`} uds.
                        </span>
                      </td>

                      <td className="p-3.5 text-xs">
                        {isInbound ? (
                          <div>
                            <span className="text-slate-500">Ref. cliente: </span>
                            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">
                              {order.reference ?? '—'}
                            </code>
                          </div>
                        ) : (
                          <div>
                            <div className="font-medium text-slate-700">
                              {order.exit_type
                                ? EXIT_TYPE_LABELS[order.exit_type]
                                : 'Salida de stock'}
                            </div>
                            {order.tracking_number ? (
                              <div className="mt-0.5">
                                <span className="text-slate-500">Tracking: </span>
                                <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-800">
                                  {order.tracking_number}
                                </code>
                              </div>
                            ) : (
                              <span className="text-slate-400">Sin tracking (`loss`)</span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="p-3.5 text-xs text-slate-700">
                        {formatOrderTimestamp(order.created_at)}
                      </td>

                      <td className="p-3.5">
                        <code className="inline-flex items-center rounded-md border border-slate-200 bg-slate-100 px-2 py-1 font-mono text-xs font-semibold text-slate-800">
                          {order.user_uuid}
                        </code>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>
    </InventoryShell>
  );
}
