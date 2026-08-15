import type { Carrier, ReturnItem, B2BClient } from '../types/models.js';
export declare function calculateAverageOnTimeRate(carriers: Carrier[]): number;
export declare function countReturnsByStatus(returns: ReturnItem[]): Record<string, number>;
export declare function getClientsAtRisk(clients: B2BClient[], thresholdDays: number): B2BClient[];
//# sourceMappingURL=transformations.d.ts.map