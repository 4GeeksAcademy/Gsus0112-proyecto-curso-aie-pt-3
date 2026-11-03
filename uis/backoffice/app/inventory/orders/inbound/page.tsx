'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';

import {
  InventoryShell,
  StockLevelBadge,
  WarehouseBadge,
} from '@/src/components/InventoryShell';
import {
  CATEGORY_LABELS,
  WAREHOUSE_LABELS,
  createInboundOrder,
  fetchInventoryProducts,
  getAvailableStockForWarehouse,
} from '@/src/lib/inventory';
import type { SKUItem, StockEntryItem, WarehouseCode } from '@/src/lib/inventory';

function InboundOrderFormContent(): ReactElement {
  const searchParams = useSearchParams();
  const initialSkuIdParam = searchParams.get('sku_id');

  const [products, setProducts] = useState<SKUItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedSkuId, setSelectedSkuId] = useState<string>('');
  const [warehouse, setWarehouse] = useState<WarehouseCode>('LA');
  const [quantity, setQuantity] = useState<string>('');
  const [reference, setReference] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdEntry, setCreatedEntry] = useState<{
    entry: StockEntryItem;
    productName: string;
    skuCode: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingProducts(true);
    setLoadError(null);

    void fetchInventoryProducts(undefined, controller.signal)
      .then((list) => {
        if (controller.signal.aborted) return;
        setProducts(list);

        if (list.length > 0) {
          const requestedId = initialSkuIdParam ? Number(initialSkuIdParam) : NaN;
          const preselected = list.find((item) => item.id === requestedId) ?? list[0];
          if (preselected) {
            setSelectedSkuId((prev) => {
              if (prev && list.some((p) => String(p.id) === prev)) {
                return prev;
              }
              setWarehouse(preselected.warehouse);
              return String(preselected.id);
            });
          }
        }
      })
      .catch((err: unknown) => {
        if (!controller.signal.aborted) {
          setLoadError(
            err instanceof Error
              ? err.message
              : 'No se pudieron cargar los SKUs disponibles desde la API.',
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingProducts(false);
        }
      });

    return () => controller.abort();
  }, [initialSkuIdParam, reloadKey]);

  const selectedProduct = useMemo(
    () => products.find((item) => String(item.id) === selectedSkuId) ?? null,
    [products, selectedSkuId],
  );

  const currentWarehouseStock = useMemo(
    () => getAvailableStockForWarehouse(selectedProduct, warehouse),
    [selectedProduct, warehouse],
  );

  function handleSelectProduct(newSkuId: string): void {
    setSelectedSkuId(newSkuId);
    setSubmitError(null);
    const match = products.find((item) => String(item.id) === newSkuId);
    if (match) {
      setWarehouse(match.warehouse);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitError(null);
    setCreatedEntry(null);

    const parsedSkuId = Number(selectedSkuId);
    const parsedQuantity = Number(quantity);

    if (!Number.isInteger(parsedSkuId) || parsedSkuId <= 0) {
      setSubmitError('Selecciona un producto (SKU) válido de la lista.');
      return;
    }
    if (!Number.isInteger(parsedQuantity) || parsedQuantity <= 0) {
      setSubmitError('La cantidad recibida (`quantity`) debe ser un número entero mayor a 0.');
      return;
    }
    if (!reference.trim()) {
      setSubmitError(
        'Ingresa el código de referencia de recepción o pedido de compra (`reference`, ej. PO-2024-0098).',
      );
      return;
    }

    setSubmitting(true);
    try {
      const entry = await createInboundOrder({
        sku_id: parsedSkuId,
        quantity: parsedQuantity,
        reference: reference.trim(),
        warehouse,
      });

      setCreatedEntry({
        entry,
        productName: selectedProduct?.name ?? `SKU #${parsedSkuId}`,
        skuCode: selectedProduct?.sku ?? String(parsedSkuId),
      });

      // Limpiar los campos editables del formulario tras un registro exitoso
      setQuantity('');
      setReference('');
      setReloadKey((prev) => prev + 1);
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : 'No se pudo registrar la orden de entrada en este momento.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section
        aria-labelledby="inbound-form-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2"
      >
        <div className="mb-5 border-b border-slate-200 pb-4">
          <h2 id="inbound-form-heading" className="text-lg font-bold text-slate-900">
            Nueva Recepción de Mercancía (`StockEntry`)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Endpoint: <code className="font-mono text-slate-700">POST /inventory/orders/inbound</code> ·
            Incrementa el stock del SKU en el almacén receptor y registra tu{' '}
            <code className="font-mono text-slate-700">user_uuid</code>.
          </p>
        </div>

        {loadError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900"
          >
            <p className="font-semibold">{loadError}</p>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setReloadKey((prev) => prev + 1)}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
              >
                Reintentar carga de productos
              </button>
              <Link href="/backoffice/inventory/products" className="text-xs font-semibold underline">
                Ir al catálogo de SKUs
              </Link>
            </div>
          </div>
        )}

        {submitError && (
          <div
            role="alert"
            className="mb-5 rounded-xl border-l-4 border-red-600 bg-red-50 p-4 text-sm text-red-900"
          >
            <p className="font-semibold">Error al registrar la orden de entrada</p>
            <p className="mt-1">{submitError}</p>
          </div>
        )}

        {createdEntry && (
          <div
            role="status"
            className="mb-5 rounded-xl border-l-4 border-emerald-600 bg-emerald-50 p-4 text-sm text-emerald-950"
          >
            <p className="font-bold">
              ✓ Orden de entrada #{createdEntry.entry.id} registrada correctamente
            </p>
            <p className="mt-1 text-xs text-emerald-900">
              Se añadieron <strong>+{createdEntry.entry.quantity} unidades</strong> a{' '}
              <strong>{createdEntry.productName}</strong> ({createdEntry.skuCode}) en el almacén{' '}
              <strong>{createdEntry.entry.warehouse}</strong> con referencia{' '}
              <code className="font-mono font-semibold">{createdEntry.entry.reference}</code> (operario{' '}
              <code className="font-mono">{createdEntry.entry.user_uuid}</code>).
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <Link
                href="/backoffice/inventory/products"
                className="rounded-lg bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-800"
              >
                Ver stock actualizado en catálogo
              </Link>
              <Link
                href="/backoffice/inventory/orders"
                className="rounded-lg border border-emerald-700 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Ver en historial de órdenes
              </Link>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="inbound-sku-select"
              className="mb-1.5 block text-sm font-semibold text-slate-800"
            >
              Producto / SKU (`sku_id`) <span className="text-red-600">*</span>
            </label>
            <select
              id="inbound-sku-select"
              required
              disabled={loadingProducts || products.length === 0}
              value={selectedSkuId}
              onChange={(e) => handleSelectProduct(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 disabled:bg-slate-100"
            >
              {loadingProducts ? (
                <option value="">Cargando catálogo de productos...</option>
              ) : products.length === 0 ? (
                <option value="">No hay SKUs disponibles en el catálogo</option>
              ) : (
                products.map((item) => (
                  <option key={item.id} value={String(item.id)}>
                    {item.name} — [{item.sku}] · {item.client_name} · Almacén {item.warehouse} (Stock:{' '}
                    {item.current_stock} uds.)
                  </option>
                ))
              )}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Selecciona el producto por su nombre descriptivo y código de cliente.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="inbound-warehouse"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Almacén receptor (`warehouse`) <span className="text-red-600">*</span>
              </label>
              <select
                id="inbound-warehouse"
                value={warehouse}
                onChange={(e) => setWarehouse(e.target.value as WarehouseCode)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              >
                <option value="LA">{WAREHOUSE_LABELS.LA}</option>
                <option value="ZGZ">{WAREHOUSE_LABELS.ZGZ}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="inbound-quantity"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Cantidad recibida (`quantity`) <span className="text-red-600">*</span>
              </label>
              <input
                id="inbound-quantity"
                type="number"
                min={1}
                step={1}
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ej. 50"
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="inbound-reference"
              className="mb-1.5 block text-sm font-semibold text-slate-800"
            >
              Referencia de despacho / Orden de compra (`reference`) <span className="text-red-600">*</span>
            </label>
            <input
              id="inbound-reference"
              type="text"
              required
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="Ej. PO-2024-0098 o GR-LA-0234"
              className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
            />
            <p className="mt-1 text-xs text-slate-500">
              Código asignado por la marca cliente o albarán de entrada de almacén.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <Link
              href="/backoffice/inventory/products"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={submitting || loadingProducts || products.length === 0}
              className="rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-emerald-700 disabled:opacity-50"
            >
              {submitting ? 'Registrando entrada...' : '📥 Confirmar Orden de Entrada'}
            </button>
          </div>
        </form>
      </section>

      {/* Ficha lateral del SKU seleccionado */}
      <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Ficha del SKU Seleccionado
        </h3>
        {selectedProduct ? (
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Producto (`name`)</p>
              <p className="font-bold text-slate-900">{selectedProduct.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Código (`sku`)</p>
                <p className="font-mono font-bold text-slate-800">{selectedProduct.sku}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Marca (`client_name`)</p>
                <p className="font-semibold text-slate-800">{selectedProduct.client_name}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Categoría</p>
                <p className="font-medium text-slate-700">
                  {CATEGORY_LABELS[selectedProduct.category] ?? selectedProduct.category}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Almacén destino</p>
                <div className="mt-1">
                  <WarehouseBadge warehouse={warehouse} />
                </div>
              </div>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold text-slate-600">
                Stock actual en {warehouse} antes de la recepción:
              </p>
              <div className="mt-2">
                <StockLevelBadge currentStock={currentWarehouseStock} />
              </div>
              {Number(quantity) > 0 && (
                <p className="mt-2 text-xs font-semibold text-emerald-700">
                  Stock proyectado tras recepción: {currentWarehouseStock + Number(quantity)} uds.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Selecciona un SKU del desplegable para ver su stock actual y metadatos de cliente.
          </p>
        )}
      </aside>
    </div>
  );
}

export default function InboundOrderPage(): ReactElement {
  return (
    <InventoryShell
      title="Registrar Orden de Entrada (StockEntry)"
      subtitle="Registra la recepción de mercancía enviada por una marca cliente hacia los almacenes de Los Ángeles (LA) o Zaragoza (ZGZ)."
    >
      <Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Cargando formulario de orden de entrada...
          </div>
        }
      >
        <InboundOrderFormContent />
      </Suspense>
    </InventoryShell>
  );
}
