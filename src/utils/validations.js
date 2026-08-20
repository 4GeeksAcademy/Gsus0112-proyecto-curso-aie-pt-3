export function isValidMonthlyVolume(volume) {
    return Number.isFinite(volume) && volume > 0;
}
export function isValidClient(client) {
    const hasId = client.id.trim().length > 0;
    const hasCompanyName = client.companyName.trim().length > 0;
    return hasId && hasCompanyName && isValidMonthlyVolume(client.monthlyVolume);
}
export function isValidCarrierRate(rate) {
    const normalizedRate = rate;
    return Number.isFinite(normalizedRate) && normalizedRate >= 0 && normalizedRate <= 100;
}
export function isOfficialCarrier(carrierName) {
    const officialCarriers = ['UPS', 'FEDEX', 'DHL', 'MRW', 'SEUR'];
    const normalizedName = carrierName.toUpperCase();
    return officialCarriers.some((officialCarrier) => normalizedName.includes(officialCarrier));
}
export function isValidContractDays(days) {
    return Number.isInteger(days) && days >= 0 && days <= 365;
}
export function isReturnRateNormal(totalVolume, returnVolume) {
    if (!Number.isFinite(totalVolume) ||
        !Number.isFinite(returnVolume) ||
        totalVolume <= 0 ||
        returnVolume < 0) {
        return false;
    }
    const returnRatePercentage = (returnVolume / totalVolume) * 100;
    return returnRatePercentage >= 18 && returnRatePercentage <= 25;
}
//# sourceMappingURL=validations.js.map