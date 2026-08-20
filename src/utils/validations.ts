import type { B2BClient, Carrier } from '../types/models.js';

type CarrierRate = Carrier['onTimeDeliveryRate'];

export function isValidMonthlyVolume(volume: number): boolean {
  return Number.isFinite(volume) && volume > 0;
}

export function isValidClient(client: B2BClient): boolean {
  const hasId = client.id.trim().length > 0;
  const hasCompanyName = client.companyName.trim().length > 0;

  return hasId && hasCompanyName && isValidMonthlyVolume(client.monthlyVolume);
}

export function isValidCarrierRate(rate: number): boolean {
  const normalizedRate: CarrierRate = rate;
  return Number.isFinite(normalizedRate) && normalizedRate >= 0 && normalizedRate <= 100;
}

export function isOfficialCarrier(carrierName: string): boolean {
  const officialCarriers = ['UPS', 'FEDEX', 'DHL', 'MRW', 'SEUR'] as const;
  const normalizedName = carrierName.toUpperCase();

  return officialCarriers.some((officialCarrier) =>
    normalizedName.includes(officialCarrier),
  );
}

export function isValidContractDays(days: number): boolean {
  return Number.isInteger(days) && days >= 0 && days <= 365;
}

export function isReturnRateNormal(
  totalVolume: number,
  returnVolume: number,
): boolean {
  if (
    !Number.isFinite(totalVolume) ||
    !Number.isFinite(returnVolume) ||
    totalVolume <= 0 ||
    returnVolume < 0
  ) {
    return false;
  }

  const returnRatePercentage = (returnVolume / totalVolume) * 100;
  return returnRatePercentage >= 18 && returnRatePercentage <= 25;
}