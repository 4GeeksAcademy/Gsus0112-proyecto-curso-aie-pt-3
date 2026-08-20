import type { Carrier, ReturnItem, B2BClient } from '../types/models.js';

export function calculateAverageOnTimeRate(carriers: Carrier[]): number {
  if (carriers.length === 0) {
    return 0;
  }

  const rates = carriers.map((carrier) => carrier.onTimeDeliveryRate);
  const total = rates.reduce((sum, rate) => sum + rate, 0);

  return total / rates.length;
}

export function countReturnsByStatus(
  returns: ReturnItem[],
): Record<string, number> {
  return returns.reduce<Record<string, number>>(
    (acc, item) => {
      acc[item.status] = (acc[item.status] ?? 0) + 1;
      return acc;
    },
    {
      pending: 0,
      approved: 0,
      rejected: 0,
    },
  );
}

export function getClientsAtRisk(
  clients: B2BClient[],
  thresholdDays: number,
): B2BClient[] {
  return clients.filter(
    (client) => client.daysToContractExpiration <= thresholdDays,
  );
}

export function calculateTotalMonthlyVolume(clients: B2BClient[]): number {
  if (clients.length === 0) {
    return 0;
  }

  return clients.reduce((total, client) => total + client.monthlyVolume, 0);
}

export function findBestPerformingCarrier(
  carriers: Carrier[],
): Carrier | null {
  if (carriers.length === 0) {
    return null;
  }

  return carriers.reduce((bestCarrier, currentCarrier) =>
    currentCarrier.onTimeDeliveryRate > bestCarrier.onTimeDeliveryRate
      ? currentCarrier
      : bestCarrier,
  );
}

export function findCheapestCarrier(carriers: Carrier[]): Carrier | null {
  if (carriers.length === 0) {
    return null;
  }

  return carriers.reduce((cheapestCarrier, currentCarrier) =>
    currentCarrier.costPerKg < cheapestCarrier.costPerKg
      ? currentCarrier
      : cheapestCarrier,
  );
}