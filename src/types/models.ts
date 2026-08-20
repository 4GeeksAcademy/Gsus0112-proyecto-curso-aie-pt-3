export type Country = 'US' | 'ES';
export type ReturnStatus = 'pending' | 'approved' | 'rejected';
export type ReturnCondition = 'good' | 'damaged' | 'unknown';

export interface Carrier {
    id: string;
    name: string;
    onTimeDeliveryRate: number;
    costPerKg: number;
}

export interface ReturnItem {
    id: string;
    sku: string;
    clientId: string;
    country: Country;
    status: ReturnStatus;
    condition: ReturnCondition;
}

export interface Client {
    id: string;
    companyName: string;
    monthlyVolume: number;
    daysToContractExpiration: number;
}

export type B2BClient = Client;