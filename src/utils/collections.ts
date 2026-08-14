import type { Carrier, ReturnItem, Country } from '../types/models.js';

export function filterReturnsByCountry(
  returns: ReturnItem[],
  country: Country,
): ReturnItem[] {
  if (returns.length === 0) {
    return [];
  }

  return returns.filter((item) => item.country === country);
}

export function sortCarriersByCost(
  carriers: Carrier[],
  order: 'asc' | 'desc' = 'asc',
): Carrier[] {
  const sorted = [...carriers].sort((a, b) => a.costPerKg - b.costPerKg);

  return order === 'desc' ? sorted.reverse() : sorted;
}