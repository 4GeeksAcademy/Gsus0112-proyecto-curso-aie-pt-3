import type { Carrier, ReturnItem, ReturnStatus, Client, Shipment, InventoryItem, B2BClient } from '../types/models.js';
export declare const calculateAverageOnTimeRate: (carriers: Carrier[]) => number;
export declare const countReturnsByStatus: (returns: ReturnItem[]) => Record<ReturnStatus, number>;
export declare const getClientsAtRisk: (clients: Client[], thresholdDays: number) => Client[];
export declare const calculateTotalMonthlyVolume: (clients: Client[]) => number;
export declare const findHighestMonthlyVolumeClient: (clients: Client[]) => Client | null;
export declare const findLowestMonthlyVolumeClient: (clients: Client[]) => Client | null;
export declare const findBestPerformingCarrier: (carriers: Carrier[]) => Carrier | null;
export declare const findCheapestCarrier: (carriers: Carrier[]) => Carrier | null;
/**
 * Retorna el envio con mayor shippingCost.
 */
export declare const findMaxShippingCost: (shipments: Shipment[]) => Shipment | null;
/**
 * Retorna el envio con menor shippingCost.
 */
export declare const findMinShippingCost: (shipments: Shipment[]) => Shipment | null;
/**
 * Retorna el articulo con mayor cantidad de inventario.
 */
export declare const findMaxInventoryStock: (items: InventoryItem[]) => InventoryItem | null;
/**
 * Retorna el articulo con menor cantidad de inventario.
 */
export declare const findMinInventoryStock: (items: InventoryItem[]) => InventoryItem | null;
/**
 * Retorna el cliente B2B con mayor MRR.
 */
export declare const findMaxMRRClient: (clients: B2BClient[]) => B2BClient | null;
/**
 * Retorna el cliente B2B con menor MRR.
 */
export declare const findMinMRRClient: (clients: B2BClient[]) => B2BClient | null;
//# sourceMappingURL=transformations.d.ts.map