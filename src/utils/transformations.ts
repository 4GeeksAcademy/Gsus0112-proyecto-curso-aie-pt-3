import type {
    Carrier,
    ReturnItem,
    ReturnStatus,
    Client,
    Shipment,
    InventoryItem,
    B2BClient,
} from '../types/models.js';

export const calculateAverageOnTimeRate = (carriers: Carrier[]): number => {
    if (carriers.length === 0) return 0;
    const totalRate = carriers.reduce((sum, carrier) => sum + carrier.onTimeDeliveryRate, 0);
    return totalRate / carriers.length;
};

export const countReturnsByStatus = (returns: ReturnItem[]): Record<ReturnStatus, number> => {
    return returns.reduce(
        (acc, item) => {
            acc[item.status] += 1;
            return acc;
        },
        {
            pending: 0,
            approved: 0,
            rejected: 0,
        },
    );
};

export const getClientsAtRisk = (clients: Client[], thresholdDays: number): Client[] => {
    if (clients.length === 0) return [];
    return clients.filter(client => client.daysToContractExpiration <= thresholdDays);
};

export const calculateTotalMonthlyVolume = (clients: Client[]): number => {
    if (clients.length === 0) return 0;
    return clients.reduce((total, client) => total + client.monthlyVolume, 0);
};

export const findHighestMonthlyVolumeClient = (clients: Client[]): Client | null => {
    if (clients.length === 0) return null;
    return clients.reduce((highest, current) =>
        current.monthlyVolume > highest.monthlyVolume ? current : highest,
    );
};

export const findLowestMonthlyVolumeClient = (clients: Client[]): Client | null => {
    if (clients.length === 0) return null;
    return clients.reduce((lowest, current) =>
        current.monthlyVolume < lowest.monthlyVolume ? current : lowest,
    );
};

export const findBestPerformingCarrier = (carriers: Carrier[]): Carrier | null => {
    if (carriers.length === 0) return null;
    return carriers.reduce((best, current) => current.onTimeDeliveryRate > best.onTimeDeliveryRate ? current : best);
};

export const findCheapestCarrier = (carriers: Carrier[]): Carrier | null => {
    if (carriers.length === 0) return null;
    return carriers.reduce((cheapest, current) => current.costPerKg < cheapest.costPerKg ? current : cheapest);
};

/**
 * Retorna el envio con mayor shippingCost.
 */
export const findMaxShippingCost = (shipments: Shipment[]): Shipment | null => {
    if (shipments.length === 0) return null;
    return shipments.reduce((max, current) =>
        current.shippingCost > max.shippingCost ? current : max,
    );
};

/**
 * Retorna el envio con menor shippingCost.
 */
export const findMinShippingCost = (shipments: Shipment[]): Shipment | null => {
    if (shipments.length === 0) return null;
    return shipments.reduce((min, current) =>
        current.shippingCost < min.shippingCost ? current : min,
    );
};

/**
 * Retorna el articulo con mayor cantidad de inventario.
 */
export const findMaxInventoryStock = (items: InventoryItem[]): InventoryItem | null => {
    if (items.length === 0) return null;
    return items.reduce((max, current) =>
        current.quantity > max.quantity ? current : max,
    );
};

/**
 * Retorna el articulo con menor cantidad de inventario.
 */
export const findMinInventoryStock = (items: InventoryItem[]): InventoryItem | null => {
    if (items.length === 0) return null;
    return items.reduce((min, current) =>
        current.quantity < min.quantity ? current : min,
    );
};

/**
 * Retorna el cliente B2B con mayor MRR.
 */
export const findMaxMRRClient = (clients: B2BClient[]): B2BClient | null => {
    if (clients.length === 0) return null;
    return clients.reduce((max, current) =>
        current.mrr > max.mrr ? current : max,
    );
};

/**
 * Retorna el cliente B2B con menor MRR.
 */
export const findMinMRRClient = (clients: B2BClient[]): B2BClient | null => {
    if (clients.length === 0) return null;
    return clients.reduce((min, current) =>
        current.mrr < min.mrr ? current : min,
    );
};