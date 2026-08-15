import { sortCarriersByCost } from './utils/collections.js';
import { countReturnsByStatus } from './utils/transformations.js';
import type { Carrier, ReturnItem } from './types/models.js';

const carriers: Carrier[] = [
  {
    id: 'c1',
    name: 'UPS',
    onTimeDeliveryRate: 96,
    costPerKg: Number((Math.random() * 4 + 3).toFixed(2)),
  },
  {
    id: 'c2',
    name: 'FedEx',
    onTimeDeliveryRate: 94,
    costPerKg: Number((Math.random() * 4 + 3).toFixed(2)),
  },
  {
    id: 'c3',
    name: 'MRW',
    onTimeDeliveryRate: 91,
    costPerKg: Number((Math.random() * 4 + 3).toFixed(2)),
  },
];

const returns: ReturnItem[] = [
  {
    id: 'r1',
    sku: 'SKU-1001',
    clientId: 'cli-1',
    country: 'ES',
    status: 'pending',
    condition: 'good',
  },
  {
    id: 'r2',
    sku: 'SKU-1002',
    clientId: 'cli-2',
    country: 'US',
    status: 'approved',
    condition: 'damaged',
  },
  {
    id: 'r3',
    sku: 'SKU-1003',
    clientId: 'cli-3',
    country: 'ES',
    status: 'rejected',
    condition: 'unknown',
  },
  {
    id: 'r4',
    sku: 'SKU-1004',
    clientId: 'cli-4',
    country: 'US',
    status: 'approved',
    condition: 'good',
  },
  {
    id: 'r5',
    sku: 'SKU-1005',
    clientId: 'cli-5',
    country: 'ES',
    status: 'pending',
    condition: 'damaged',
  },
];

const sortButton = document.getElementById('sort-carriers-btn');
const reportButton = document.getElementById('status-report-btn');
const carriersResult = document.getElementById('carriers-result');
const returnsResult = document.getElementById('returns-result');

if (sortButton && carriersResult) {
  sortButton.addEventListener('click', () => {
    const sorted = sortCarriersByCost(carriers, 'asc');

    carriersResult.innerHTML = sorted
      .map(
        (carrier, index) => `
          <li class="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <div class="flex items-center justify-between gap-4">
              <p class="font-semibold text-slate-800">${index + 1}. ${carrier.name}</p>
              <span class="font-mono text-sm text-teal-700">$${carrier.costPerKg.toFixed(2)} / kg</span>
            </div>
            <p class="mt-1 text-xs text-slate-600">Puntualidad: ${carrier.onTimeDeliveryRate}%</p>
          </li>
        `,
      )
      .join('');
  });
}

if (reportButton && returnsResult) {
  reportButton.addEventListener('click', () => {
    const summary = countReturnsByStatus(returns);

    returnsResult.innerHTML = Object.entries(summary)
      .map(
        ([status, total]) => `
          <div class="rounded-xl border border-slate-200 bg-white p-3">
            <p class="text-xs uppercase tracking-[0.15em] text-slate-500">${status}</p>
            <p class="mt-1 font-mono text-2xl font-semibold text-slate-800">${total}</p>
          </div>
        `,
      )
      .join('');
  });
}
