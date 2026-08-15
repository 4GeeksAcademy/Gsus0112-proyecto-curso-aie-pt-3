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
//# sourceMappingURL=validations.js.map