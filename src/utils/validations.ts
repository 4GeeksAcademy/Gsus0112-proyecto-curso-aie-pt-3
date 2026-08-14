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