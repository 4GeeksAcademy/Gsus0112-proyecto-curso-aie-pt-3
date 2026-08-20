import type { Carrier, ReturnItem, ReturnStatus, Client } from '../types/models.js';
export declare const calculateAverageOnTimeRate: (carriers: Carrier[]) => number;
export declare const countReturnsByStatus: (returns: ReturnItem[]) => Record<ReturnStatus, number>;
export declare const getClientsAtRisk: (clients: Client[], thresholdDays: number) => Client[];
export declare const calculateTotalMonthlyVolume: (clients: Client[]) => number;
export declare const findHighestMonthlyVolumeClient: (clients: Client[]) => Client | null;
export declare const findLowestMonthlyVolumeClient: (clients: Client[]) => Client | null;
export declare const findBestPerformingCarrier: (carriers: Carrier[]) => Carrier | null;
export declare const findCheapestCarrier: (carriers: Carrier[]) => Carrier | null;
//# sourceMappingURL=transformations.d.ts.map