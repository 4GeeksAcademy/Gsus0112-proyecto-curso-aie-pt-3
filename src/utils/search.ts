import type { Carrier, ReturnItem } from '../types/models.js';

export function findCarrierByIdLinear(
  carriers: Carrier[],
  targetId: string,
): Carrier | null {
  if (carriers.length === 0) {
    return null;
  }

  for (let i = 0; i < carriers.length; i += 1) {
    const carrier = carriers[i] as Carrier;
    if (carrier.id === targetId) {
      return carrier;
    }
  }

  return null;
}

export function findReturnByIdBinary(
  sortedReturns: ReturnItem[],
  targetId: string,
): number {
  if (sortedReturns.length === 0) {
    return -1;
  }

  let left = 0;
  let right = sortedReturns.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const item = sortedReturns[mid] as ReturnItem;
    const currentId = item.id;

    if (currentId === targetId) {
      return mid;
    }

    if (currentId < targetId) {
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return -1;
}