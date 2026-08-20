import type { Carrier, ReturnItem, Country } from '../types/models.js';

export const filterReturnsByCountry = (returns: ReturnItem[], country: Country): ReturnItem[] => {
    if (returns.length === 0) return [];
    return returns.filter(item => item.country === country);
};

export const sortCarriersByCost = (carriers: Carrier[], order: 'asc' | 'desc' = 'asc'): Carrier[] => {
    if (carriers.length === 0) return [];
    return [...carriers].sort((a, b) => {
        if (order === 'asc') return a.costPerKg - b.costPerKg;
        return b.costPerKg - a.costPerKg;
    });
};

export const filterReturns = (returns: ReturnItem[], country?: Country, status?: ReturnItem['status']): ReturnItem[] => {
    if (returns.length === 0) return [];
    return returns.filter(item => {
        const matchCountry = country ? item.country === country : true;
        const matchStatus = status ? item.status === status : true;
        return matchCountry && matchStatus;
    });
};

export const sortCarriers = (carriers: Carrier[], sortBy: 'costPerKg' | 'onTimeDeliveryRate', order: 'asc' | 'desc' = 'asc'): Carrier[] => {
    if (carriers.length === 0) return [];
    return [...carriers].sort((a, b) => {
        if (order === 'asc') return a[sortBy] - b[sortBy];
        return b[sortBy] - a[sortBy];
    });
};