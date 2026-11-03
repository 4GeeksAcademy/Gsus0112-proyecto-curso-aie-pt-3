import {
  CRITICAL_STOCK_THRESHOLD,
  LOW_STOCK_THRESHOLD,
  classifyStockLevel,
  createInboundOrder,
  createInventoryProduct,
  createOutboundOrder,
  extractInventoryApiError,
  fetchInventoryOrders,
  fetchInventoryProductById,
  fetchInventoryProducts,
  getAvailableStockForWarehouse,
  resolveInventoryApiBaseUrl,
  type SKUItem,
} from '../src/lib/inventory';

describe('inventory API integration layer (lib/inventory.ts)', () => {
  const originalEnv = process.env;
  const originalFetch = global.fetch;
  const originalWindow = global.window;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_INVENTORY_API_URL: 'http://localhost:8000',
    };
    const storage: Record<string, string> = {
      trackflow_token: 'jwt-test-token-123',
    };
    Object.defineProperty(global, 'window', {
      value: {
        localStorage: {
          getItem: jest.fn((key: string) => storage[key] ?? null),
          setItem: jest.fn((key: string, val: string) => {
            storage[key] = val;
          }),
          removeItem: jest.fn((key: string) => {
            delete storage[key];
          }),
        },
        location: {
          hostname: 'localhost',
          protocol: 'http:',
          pathname: '/backoffice/inventory/products',
          href: 'http://localhost:3001/backoffice/inventory/products',
        },
      },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    global.fetch = originalFetch;
    global.window = originalWindow;
    jest.restoreAllMocks();
  });

  it('resolves base URL from NEXT_PUBLIC_INVENTORY_API_URL', () => {
    process.env.NEXT_PUBLIC_INVENTORY_API_URL = 'http://localhost:8000/';
    expect(resolveInventoryApiBaseUrl()).toBe('http://localhost:8000');
  });

  it('classifies stock levels according to documented thresholds', () => {
    expect(CRITICAL_STOCK_THRESHOLD).toBe(10);
    expect(LOW_STOCK_THRESHOLD).toBe(50);

    expect(classifyStockLevel(0)).toEqual({
      status: 'critical',
      label: 'Sin stock (0)',
      icon: '🔴',
    });
    expect(classifyStockLevel(10).status).toBe('critical');
    expect(classifyStockLevel(11).status).toBe('low');
    expect(classifyStockLevel(50).status).toBe('low');
    expect(classifyStockLevel(51).status).toBe('healthy');
    expect(classifyStockLevel(390).status).toBe('healthy');
  });

  it('computes available stock scoped by warehouse (LA and ZGZ)', () => {
    const sampleSku: SKUItem = {
      id: 1,
      name: 'Zapatillas Running Boreal Pro',
      sku: 'TF-FSH-001',
      client_name: 'Boreal Athletics',
      category: 'fashion',
      warehouse: 'LA',
      current_stock: 165,
      stock_by_warehouse: {
        LA: 165,
        ZGZ: 25,
      },
    };

    expect(getAvailableStockForWarehouse(sampleSku, 'LA')).toBe(165);
    expect(getAvailableStockForWarehouse(sampleSku, 'ZGZ')).toBe(25);
    expect(getAvailableStockForWarehouse(null, 'LA')).toBe(0);
  });

  it('extracts readable error messages from FastAPI detail strings and validation arrays', () => {
    expect(
      extractInventoryApiError(
        {
          detail:
            "Stock insuficiente para el SKU 'TF-FSH-001' en el almacén 'LA': disponible=165, solicitado=500.",
        },
        400,
      ),
    ).toBe(
      "Stock insuficiente para el SKU 'TF-FSH-001' en el almacén 'LA': disponible=165, solicitado=500.",
    );

    expect(
      extractInventoryApiError(
        {
          detail: [{ loc: ['body', 'quantity'], msg: 'Input should be greater than 0' }],
        },
        422,
      ),
    ).toBe('Revisa los datos del formulario: quantity: Input should be greater than 0');

    expect(extractInventoryApiError(null, 500)).toContain(
      'El servidor de inventario no pudo procesar la operación',
    );
  });

  it('attaches Authorization Bearer token on GET /inventory/products', async () => {
    const mockProducts: SKUItem[] = [
      {
        id: 1,
        name: 'Zapatillas Running Boreal Pro',
        sku: 'TF-FSH-001',
        client_name: 'Boreal Athletics',
        category: 'fashion',
        warehouse: 'LA',
        current_stock: 165,
        stock_by_warehouse: { LA: 165 },
      },
    ];

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockProducts,
    } as unknown as Response);

    const result = await fetchInventoryProducts('LA');
    expect(result).toEqual(mockProducts);
    expect(global.fetch).toHaveBeenCalledTimes(1);

    const [calledUrl, calledInit] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe('http://localhost:8000/inventory/products?warehouse=LA');
    expect(calledInit.method).toBe('GET');
    const headers = new Headers(calledInit.headers);
    expect(headers.get('Authorization')).toBe('Bearer jwt-test-token-123');
  });

  it('fetches single SKU details via GET /inventory/products/{id}', async () => {
    const mockSku: SKUItem = {
      id: 2,
      name: 'Auriculares Inalámbricos Pulse ANC',
      sku: 'TF-ELC-002',
      client_name: 'Kova Electronics',
      category: 'electronics',
      warehouse: 'ZGZ',
      current_stock: 112,
      stock_by_warehouse: { ZGZ: 112 },
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockSku,
    } as unknown as Response);

    const result = await fetchInventoryProductById(2);
    expect(result.current_stock).toBe(112);
    expect(global.fetch).toHaveBeenCalledWith(
      'http://localhost:8000/inventory/products/2',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('submits inbound order via POST /inventory/orders/inbound with Bearer token', async () => {
    const mockEntry = {
      id: 10,
      sku_id: 1,
      quantity: 120,
      reference: 'PO-2026-0412',
      warehouse: 'LA' as const,
      user_uuid: 'admin-uuid',
      created_at: '2026-11-03T01:00:00Z',
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockEntry,
    } as unknown as Response);

    const created = await createInboundOrder({
      sku_id: 1,
      quantity: 120,
      reference: 'PO-2026-0412',
      warehouse: 'LA',
    });

    expect(created).toEqual(mockEntry);
    const [calledUrl, calledInit] = (global.fetch as jest.Mock).mock.calls[0] as [
      string,
      RequestInit,
    ];
    expect(calledUrl).toBe('http://localhost:8000/inventory/orders/inbound');
    expect(calledInit.method).toBe('POST');
    const headers = new Headers(calledInit.headers);
    expect(headers.get('Authorization')).toBe('Bearer jwt-test-token-123');
    expect(headers.get('Content-Type')).toBe('application/json');
  });

  it('surfaces HTTP 400 insufficient stock message on POST /inventory/orders/outbound', async () => {
    const apiErrorDetail =
      "Stock insuficiente para el SKU 'TF-FSH-001' en el almacén 'LA': disponible=165, solicitado=999.";

    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ detail: apiErrorDetail }),
    } as unknown as Response);

    await expect(
      createOutboundOrder({
        sku_id: 1,
        quantity: 999,
        exit_type: 'dispatch',
        tracking_number: 'TRK-LA-99999',
        warehouse: 'LA',
      }),
    ).rejects.toEqual(
      expect.objectContaining({
        name: 'InventoryApiError',
        status: 400,
        message: apiErrorDetail,
      }),
    );
  });

  it('creates SKU via POST /inventory/products and lists orders via GET /inventory/orders', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          id: 7,
          name: 'Sérum Facial Vitamina C 30ml',
          sku: 'TF-CSM-099',
          client_name: 'Lumière Beauty',
          category: 'cosmetics',
          warehouse: 'ZGZ',
          current_stock: 0,
          stock_by_warehouse: {},
        }),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => [
          {
            id: 1,
            order_type: 'inbound',
            sku_id: 1,
            sku: {
              id: 1,
              name: 'Zapatillas Running Boreal Pro',
              sku: 'TF-FSH-001',
              client_name: 'Boreal Athletics',
              category: 'fashion',
              warehouse: 'LA',
            },
            quantity: 200,
            warehouse: 'LA',
            reference: 'PO-2026-0101',
            exit_type: null,
            tracking_number: null,
            user_uuid: 'user-uuid-001',
            created_at: '2026-11-03T01:00:00Z',
          },
        ],
      } as unknown as Response);

    const createdSku = await createInventoryProduct({
      name: 'Sérum Facial Vitamina C 30ml',
      sku: 'TF-CSM-099',
      client_name: 'Lumière Beauty',
      category: 'cosmetics',
      warehouse: 'ZGZ',
    });
    expect(createdSku.current_stock).toBe(0);

    const orders = await fetchInventoryOrders('LA');
    expect(orders).toHaveLength(1);
    expect(orders[0].sku.sku).toBe('TF-FSH-001');
  });
});
