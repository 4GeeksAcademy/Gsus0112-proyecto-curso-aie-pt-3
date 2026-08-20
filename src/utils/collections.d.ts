import type { Carrier, ReturnItem, Country } from '../types/models.js';
export declare const filterReturnsByCountry: (returns: ReturnItem[], country: Country) => ReturnItem[];
export declare const sortCarriersByCost: (carriers: Carrier[], order?: 'asc' | 'desc') => Carrier[];
export declare const filterReturns: (returns: ReturnItem[], country?: Country, status?: ReturnItem['status']) => ReturnItem[];
export declare const sortCarriers: (carriers: Carrier[], sortBy: 'costPerKg' | 'onTimeDeliveryRate', order?: 'asc' | 'desc') => Carrier[];
//# sourceMappingURL=collections.d.ts.map