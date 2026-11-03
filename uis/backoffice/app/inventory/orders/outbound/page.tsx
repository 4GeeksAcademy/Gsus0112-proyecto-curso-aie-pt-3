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
  EXIT_TYPE_LABELS,
  InventoryApiError,
  WAREHOUSE_LABELS,
  createOutboundOrder,
  fetchInventoryProductById,
  fetchInventoryProducts,
  getAvailableStockForWarehouse,
} from '@/src/lib/inventory';
import type {
  ExitType,
  SKUItem,
  StockExitItem,
  WarehouseCode,
} from '@/src/lib/inventory';

function OutboundOrderFormContent(): ReactElement {
  const searchParams = useSearchParams();
  const initialSkuIdParam = searchParams.get('sku_id');

  const [products, setProducts] = useState<SKUItem[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selectedSkuId, setSelectedSkuId] = useState<string>('');
  const [liveProductDetail, setLiveProductDetail] = useState<SKUItem | null>(null);
  const [loadingStockDetail, setLoadingStockDetail] = useState(false);

  const [warehouse, setWarehouse] = useState<WarehouseCode>('LA');
  const [quantity, setQuantity] = useState<string>('');
  const [exitType, setExitType] = useState<ExitType>('dispatch');
  const [trackingNumber, setTrackingNumber] = useState<string>('');

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quantityApiError, setQuantityApiError] = useState<string | null>(null);
  const [createdExit, setCreatedExit] = useState<{
    exit: StockExitItem;
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

  // Consulta reactiva de `GET /inventory/products/{id}` cada vez que cambia el SKU seleccionado
  useEffect(() => {
    const parsedId = Number(selectedSkuId);
    if (!Number.isInteger(parsedId) || parsedId <= 0) {
      setLiveProductDetail(null);
      return;
    }

    const controller = new AbortController();
    setLoadingStockDetail(true);

    void fetchInventoryProductById(parsedId, controller.signal)
      .then((detail) => {
        if (!controller.signal.aborted) {
          setLiveProductDetail(detail);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          const fallback = products.find((item) => item.id === parsedId) ?? null;
          setLiveProductDetail(fallback);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoadingStockDetail(false);
        }
      });

    return () => controller.abort();
  }, [selectedSkuId, reloadKey, products]);

  const activeProduct = useMemo(() => {
    if (liveProductDetail && String(liveProductDetail.id) === selectedSkuId) {
      return liveProductDetail;
    }
    return products.find((item) => String(item.id) === selectedSkuId) ?? null;
  }, [liveProductDetail, products, selectedSkuId]);

  const availableStock = useMemo(
    () => getAvailableStockForWarehouse(activeProduct, warehouse),
    [activeProduct, warehouse],
  );

  const parsedQuantity = useMemo(() => {
    if (!quantity.trim()) return 0;
    const n = Number(quantity);
    return Number.isFinite(n) ? n : 0;
  }, [quantity]);

  // Salvaguarda de UX en el cliente cuando la cantidad introducida supera el stock disponible
  const exceedsAvailableStock = activeProduct !== null && parsedQuantity > availableStock;

  function handleSelectProduct(newSkuId: string): void {
    setSelectedSkuId(newSkuId);
    setSubmitError(null);
    setQuantityApiError(null);
    const match = products.find((item) => String(item.id) === newSkuId);
    if (match) {
      setWarehouse(match.warehouse);
    }
  }

  function handleExitTypeChange(newType: ExitType): void {
    setExitType(newType);
    setSubmitError(null);
    if (newType === 'loss') {
      setTrackingNumber('');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setSubmitError(null);
    setQuantityApiError(null);
    setCreatedExit(null);

    const parsedSkuId = Number(selectedSkuId);
    const qtyNumber = Number(quantity);

    if (!Number.isInteger(parsedSkuId) || parsedSkuId <= 0) {
      setSubmitError('Selecciona un producto (SKU) válido.');
      return;
    }
    if (!Number.isInteger(qtyNumber) || qtyNumber <= 0) {
      setQuantityApiError('La cantidad de salida (`quantity`) debe ser un entero mayor a 0.');
      setSubmitError('La cantidad de salida (`quantity`) debe ser un entero mayor a 0.');
      return;
    }

    setSubmitting(true);
    try {
      const exitRecord = await createOutboundOrder({
        sku_id: parsedSkuId,
        quantity: qtyNumber,
        exit_type: exitType,
        tracking_number:
          exitType === 'dispatch' ? trackingNumber.trim() || null : null,
        warehouse,
      });

      setCreatedExit({
        exit: exitRecord,
        productName: activeProduct?.name ?? `SKU #${parsedSkuId}`,
        skuCode: activeProduct?.sku ?? String(parsedSkuId),
      });

      // Limpiar campos del formulario y refrescar el stock disponible tras el éxito
      setQuantity('');
      setTrackingNumber('');
      setReloadKey((prev) => prev + 1);
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'No se pudo registrar la orden de salida en este momento.';
      setSubmitError(message);

      // Si la API devuelve HTTP 400 (p. ej. stock insuficiente), mostrarlo inline junto al campo de cantidad
      if (err instanceof InventoryApiError && err.status === 400) {
        setQuantityApiError(message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <section
        aria-labelledby="outbound-form-heading"
        className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs lg:col-span-2"
      >
        <div className="mb-5 border-b border-slate-200 pb-4">
          <h2 id="outbound-form-heading" className="text-lg font-bold text-slate-900">
            Nueva Orden de Salida (`StockExit` — Despacho o Baja)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Endpoint: <code className="font-mono text-slate-700">POST /inventory/orders/outbound</code> ·
            Descuenta stock del almacén seleccionado y valida disponibilidad antes de persistir.
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
                Reintentar carga
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
            <p className="font-bold">La orden de salida fue rechazada por la API</p>
            <p className="mt-1">{submitError}</p>
          </div>
        )}

        {createdExit && (
          <div
            role="status"
            className="mb-5 rounded-xl border-l-4 border-emerald-600 bg-emerald-50 p-4 text-sm text-emerald-950"
          >
            <p className="font-bold">
              ✓ Orden de salida #{createdExit.exit.id} registrada correctamente
            </p>
            <p className="mt-1 text-xs text-emerald-900">
              Se descontaron <strong>-{createdExit.exit.quantity} unidades</strong> de{' '}
              <strong>{createdExit.productName}</strong> ({createdExit.skuCode}) en el almacén{' '}
              <strong>{createdExit.exit.warehouse}</strong> · Tipo:{' '}
              <strong>{createdExit.exit.exit_type}</strong>
              {createdExit.exit.tracking_number
                ? ` · Tracking: ${createdExit.exit.tracking_number}`
                : ' · Sin tracking (pérdida)'}{' '}
              · Coordinador: <code className="font-mono">{createdExit.exit.user_uuid}</code>.
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
              htmlFor="outbound-sku-select"
              className="mb-1.5 block text-sm font-semibold text-slate-800"
            >
              Producto / SKU (`sku_id`) <span className="text-red-600">*</span>
            </label>
            <select
              id="outbound-sku-select"
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
          </div>

          {/* Panel reactivo de Stock Disponible Actual antes de introducir la cantidad */}
          <div
            aria-live="polite"
            className="rounded-xl border border-slate-200 bg-slate-50 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Stock Disponible Actual (`current_stock`) antes del envío
                </p>
                <p className="mt-0.5 text-sm text-slate-700">
                  {activeProduct ? (
                    <>
                      SKU <strong className="font-mono">{activeProduct.sku}</strong> ({activeProduct.name})
                      en almacén <strong>{warehouse}</strong>:
                    </>
                  ) : (
                    'Selecciona un producto para consultar su disponibilidad.'
                  )}
                </p>
              </div>
              {activeProduct && (
                <div className="flex items-center gap-2">
                  {loadingStockDetail ? (
                    <span className="text-xs text-slate-500">Actualizando stock...</span>
                  ) : (
                    <StockLevelBadge currentStock={availableStock} />
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="outbound-warehouse"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Almacén de salida (`warehouse`) <span className="text-red-600">*</span>
              </label>
              <select
                id="outbound-warehouse"
                value={warehouse}
                onChange={(e) => {
                  setWarehouse(e.target.value as WarehouseCode);
                  setQuantityApiError(null);
                  setSubmitError(null);
                }}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              >
                <option value="LA">{WAREHOUSE_LABELS.LA}</option>
                <option value="ZGZ">{WAREHOUSE_LABELS.ZGZ}</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="outbound-quantity"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Cantidad a descontar (`quantity`) <span className="text-red-600">*</span>
              </label>
              <input
                id="outbound-quantity"
                type="number"
                min={1}
                step={1}
                required
                aria-invalid={Boolean(quantityApiError) || exceedsAvailableStock}
                aria-describedby="outbound-quantity-feedback"
                value={quantity}
                onChange={(e) => {
                  setQuantity(e.target.value);
                  setQuantityApiError(null);
                }}
                placeholder={`Máx. disponible en ${warehouse}: ${availableStock}`}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 ${
                  quantityApiError
                    ? 'border-red-600 ring-1 ring-red-600'
                    : exceedsAvailableStock
                      ? 'border-amber-500 ring-1 ring-amber-500'
                      : 'border-slate-300'
                }`}
              />

              <div id="outbound-quantity-feedback" className="mt-2 space-y-2">
                {/* Advertencia reactiva en el cliente cuando la cantidad introducida supera el stock disponible */}
                {exceedsAvailableStock && (
                  <p
                    role="status"
                    className="rounded-lg border border-amber-300 bg-amber-50 p-2.5 text-xs font-semibold text-amber-900"
                  >
                    ⚠️ Advertencia de cliente: la cantidad introducida ({parsedQuantity} uds.) supera el
                    stock disponible actual ({availableStock} uds.) para{' '}
                    <code className="font-mono">{activeProduct?.sku}</code> en el almacén {warehouse}.
                  </p>
                )}

                {/* Error HTTP 400 de la API mostrado inline junto al campo de cantidad */}
                {quantityApiError && (
                  <p
                    role="alert"
                    className="rounded-lg border border-red-300 bg-red-50 p-2.5 text-xs font-bold text-red-800"
                  >
                    ❌ Error de stock (HTTP 400): {quantityApiError}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="outbound-exit-type"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Tipo de salida (`exit_type`) <span className="text-red-600">*</span>
              </label>
              <select
                id="outbound-exit-type"
                value={exitType}
                onChange={(e) => handleExitTypeChange(e.target.value as ExitType)}
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900"
              >
                <option value="dispatch">{EXIT_TYPE_LABELS.dispatch}</option>
                <option value="loss">{EXIT_TYPE_LABELS.loss}</option>
              </select>
              <p className="mt-1 text-xs text-slate-500">
                Regla 3: `tracking_number` es obligatorio en `dispatch` y nulo en `loss`.
              </p>
            </div>

            <div>
              <label
                htmlFor="outbound-tracking"
                className="mb-1.5 block text-sm font-semibold text-slate-800"
              >
                Número de seguimiento (`tracking_number`){' '}
                {exitType === 'dispatch' ? (
                  <span className="text-red-600">*</span>
                ) : (
                  <span className="text-xs font-normal text-slate-500">(No aplica en pérdidas)</span>
                )}
              </label>
              <input
                id="outbound-tracking"
                type="text"
                required={exitType === 'dispatch'}
                disabled={exitType === 'loss'}
                value={exitType === 'loss' ? '' : trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder={
                  exitType === 'dispatch'
                    ? 'Ej. 1Z999AA10123456784 o ESMRW0098451203'
                    : 'Nulo automáticamente para exit_type = loss'
                }
                className="w-full rounded-lg border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
              />
            </div>
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
              {submitting ? 'Procesando salida...' : '📤 Confirmar Orden de Salida'}
            </button>
          </div>
        </form>
      </section>

      {/* Panel lateral de resumen del producto y balance proyectado */}
      <aside className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Control de Disponibilidad
        </h3>
        {activeProduct ? (
          <div className="mt-4 space-y-4 text-sm">
            <div>
              <p className="text-xs text-slate-500">Producto seleccionado (`name`)</p>
              <p className="font-bold text-slate-900">{activeProduct.name}</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Código (`sku`)</p>
                <p className="font-mono font-bold text-slate-800">{activeProduct.sku}</p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Marca (`client_name`)</p>
                <p className="font-semibold text-slate-800">{activeProduct.client_name}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-slate-500">Categoría</p>
                <p className="font-medium text-slate-700">
                  {CATEGORY_LABELS[activeProduct.category] ?? activeProduct.category}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Almacén de origen</p>
                <div className="mt-1">
                  <WarehouseBadge warehouse={warehouse} />
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
              <p className="text-xs font-semibold text-slate-600">
                Stock disponible en {warehouse}:
              </p>
              <p className="mt-1 text-2xl font-extrabold text-slate-900">
                {availableStock} <span className="text-sm font-normal text-slate-600">unidades</span>
              </p>
              {parsedQuantity > 0 && (
                <p
                  className={`mt-2 text-xs font-bold ${
                    exceedsAvailableStock ? 'text-red-700' : 'text-emerald-700'
                  }`}
                >
                  Stock resultante tras salida: {availableStock - parsedQuantity} uds.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">
            Selecciona un SKU para verificar su stock disponible por almacén antes de despachar.
          </p>
        )}
      </aside>
    </div>
  );
}

export default function OutboundOrderPage(): ReactElement {
  return (
    <InventoryShell
      title="Registrar Orden de Salida (StockExit)"
      subtitle="Registra despachos a clientes finales (`dispatch`) o bajas confirmadas (`loss`) verificando el stock disponible en tiempo real."
    >
      <Suspense
        fallback={
          <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Cargando formulario de orden de salida...
          </div>
        }
      >
        <OutboundOrderFormContent />
      </Suspense>
    </InventoryShell>
  );
}
