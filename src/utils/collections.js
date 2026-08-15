export function filterReturnsByCountry(returns, country) {
    if (returns.length === 0) {
        return [];
    }
    return returns.filter((item) => item.country === country);
}
export function sortCarriersByCost(carriers, order = 'asc') {
    const sorted = [...carriers].sort((a, b) => a.costPerKg - b.costPerKg);
    return order === 'desc' ? sorted.reverse() : sorted;
}
//# sourceMappingURL=collections.js.map