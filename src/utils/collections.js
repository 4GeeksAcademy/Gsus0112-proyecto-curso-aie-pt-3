export const filterReturnsByCountry = (returns, country) => {
    if (returns.length === 0)
        return [];
    return returns.filter(item => item.country === country);
};
export const sortCarriersByCost = (carriers, order = 'asc') => {
    if (carriers.length === 0)
        return [];
    return [...carriers].sort((a, b) => {
        if (order === 'asc')
            return a.costPerKg - b.costPerKg;
        return b.costPerKg - a.costPerKg;
    });
};
export const filterReturns = (returns, country, status) => {
    if (returns.length === 0)
        return [];
    return returns.filter(item => {
        const matchCountry = country ? item.country === country : true;
        const matchStatus = status ? item.status === status : true;
        return matchCountry && matchStatus;
    });
};
export const sortCarriers = (carriers, sortBy, order = 'asc') => {
    if (carriers.length === 0)
        return [];
    return [...carriers].sort((a, b) => {
        if (order === 'asc')
            return a[sortBy] - b[sortBy];
        return b[sortBy] - a[sortBy];
    });
};
//# sourceMappingURL=collections.js.map