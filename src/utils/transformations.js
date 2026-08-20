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
//# sourceMappingURL=transformations.js.map