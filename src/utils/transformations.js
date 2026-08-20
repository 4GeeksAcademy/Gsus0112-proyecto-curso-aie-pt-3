export const calculateAverageOnTimeRate = (carriers) => {
    if (carriers.length === 0)
        return 0;
    const totalRate = carriers.reduce((sum, carrier) => sum + carrier.onTimeDeliveryRate, 0);
    return totalRate / carriers.length;
};
export const countReturnsByStatus = (returns) => {
    return returns.reduce((acc, item) => {
        acc[item.status] += 1;
        return acc;
    }, {
        pending: 0,
        approved: 0,
        rejected: 0,
    });
};
export const getClientsAtRisk = (clients, thresholdDays) => {
    if (clients.length === 0)
        return [];
    return clients.filter(client => client.daysToContractExpiration <= thresholdDays);
};
export const calculateTotalMonthlyVolume = (clients) => {
    if (clients.length === 0)
        return 0;
    return clients.reduce((total, client) => total + client.monthlyVolume, 0);
};
export const findHighestMonthlyVolumeClient = (clients) => {
    if (clients.length === 0)
        return null;
    return clients.reduce((highest, current) => current.monthlyVolume > highest.monthlyVolume ? current : highest);
};
export const findLowestMonthlyVolumeClient = (clients) => {
    if (clients.length === 0)
        return null;
    return clients.reduce((lowest, current) => current.monthlyVolume < lowest.monthlyVolume ? current : lowest);
};
export const findBestPerformingCarrier = (carriers) => {
    if (carriers.length === 0)
        return null;
    return carriers.reduce((best, current) => current.onTimeDeliveryRate > best.onTimeDeliveryRate ? current : best);
};
export const findCheapestCarrier = (carriers) => {
    if (carriers.length === 0)
        return null;
    return carriers.reduce((cheapest, current) => current.costPerKg < cheapest.costPerKg ? current : cheapest);
};
/**
 * Retorna el envio con mayor shippingCost.
 */
export const findMaxShippingCost = (shipments) => {
    if (shipments.length === 0)
        return null;
    return shipments.reduce((max, current) => current.shippingCost > max.shippingCost ? current : max);
};
/**
 * Retorna el envio con menor shippingCost.
 */
export const findMinShippingCost = (shipments) => {
    if (shipments.length === 0)
        return null;
    return shipments.reduce((min, current) => current.shippingCost < min.shippingCost ? current : min);
};
/**
 * Retorna el articulo con mayor cantidad de inventario.
 */
export const findMaxInventoryStock = (items) => {
    if (items.length === 0)
        return null;
    return items.reduce((max, current) => current.quantity > max.quantity ? current : max);
};
/**
 * Retorna el articulo con menor cantidad de inventario.
 */
export const findMinInventoryStock = (items) => {
    if (items.length === 0)
        return null;
    return items.reduce((min, current) => current.quantity < min.quantity ? current : min);
};
/**
 * Retorna el cliente B2B con mayor MRR.
 */
export const findMaxMRRClient = (clients) => {
    if (clients.length === 0)
        return null;
    return clients.reduce((max, current) => current.mrr > max.mrr ? current : max);
};
/**
 * Retorna el cliente B2B con menor MRR.
 */
export const findMinMRRClient = (clients) => {
    if (clients.length === 0)
        return null;
    return clients.reduce((min, current) => current.mrr < min.mrr ? current : min);
};
//# sourceMappingURL=transformations.js.map