import type { Carrier, ReturnItem, ReturnStatus, Client } from '../types/models.js';

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