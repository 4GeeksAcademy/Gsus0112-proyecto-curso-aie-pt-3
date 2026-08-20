import type {
  Carrier,
  ReturnItem,
  Country,
  ReturnStatus,
} from '../types/models.js';

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

export function filterReturns(
  returns: ReturnItem[],
  criteria: {
    country?: Country;
    status?: ReturnStatus;
  } = {},
): ReturnItem[] {
  if (returns.length === 0) {
    return [];
  }

  const { country, status } = criteria;

  return returns.filter((item) => {
    if (country !== undefined && item.country !== country) {
      return false;
    }

    if (status !== undefined && item.status !== status) {
      return false;
    }

    return true;
  });
}

export function sortCarriers(
  carriers: Carrier[],
  field: 'costPerKg' | 'onTimeDeliveryRate',
  order: 'asc' | 'desc' = 'asc',
): Carrier[] {
  if (carriers.length === 0) {
    return [];
  }

  const direction = order === 'asc' ? 1 : -1;

  return [...carriers].sort(
    (a, b) => (a[field] - b[field]) * direction,
  );
}