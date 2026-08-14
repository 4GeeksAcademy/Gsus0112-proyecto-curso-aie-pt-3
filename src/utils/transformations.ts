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