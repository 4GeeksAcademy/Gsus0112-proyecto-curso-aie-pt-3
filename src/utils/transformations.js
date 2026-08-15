export function calculateAverageOnTimeRate(carriers) {
    if (carriers.length === 0) {
        return 0;
    }
    const rates = carriers.map((carrier) => carrier.onTimeDeliveryRate);
    const total = rates.reduce((sum, rate) => sum + rate, 0);
    return total / rates.length;
}
export function countReturnsByStatus(returns) {
    return returns.reduce((acc, item) => {
        acc[item.status] = (acc[item.status] ?? 0) + 1;
        return acc;
    }, {
        pending: 0,
        approved: 0,
        rejected: 0,
    });
}
export function getClientsAtRisk(clients, thresholdDays) {
    return clients.filter((client) => client.daysToContractExpiration <= thresholdDays);
}
//# sourceMappingURL=transformations.js.map