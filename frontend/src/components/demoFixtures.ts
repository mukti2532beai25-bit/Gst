import type { BillExtractionResponse } from '../../../shared/types';

/**
 * Bundled fallback used when the demo backend is unreachable. Shape matches
 * MOCK_EXTRACTION from the backend so the review UI never renders empty.
 */
export const DEMO_BILL: BillExtractionResponse = {
  billId: 'demo-bill-001',
  status: 'needs_review',
  language: 'pa',
  fields: {
    billNumber: { value: 'B-102', confidence: 0.94, reviewStatus: 'pending' },
    billDate: { value: '2026-10-31', confidence: 0.88, reviewStatus: 'pending' },
    customerName: { value: 'Ravi Kumar', confidence: 0.82, reviewStatus: 'pending' },
    grandTotal: { value: 336, confidence: 0.71, reviewStatus: 'pending' }
  },
  items: [
    {
      description: 'Sugar (Chini)',
      quantity: 5,
      unit: 'kg',
      unitPrice: 42,
      lineTotal: 210,
      reviewStatus: 'pending'
    }
  ],
  warnings: ['Calculated line items total does not match bill grand total.']
};

export function cloneBill<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const SAMPLE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl2nQAAAABJRU5ErkJggg==';

export function sampleBillFile(): Blob {
  const binary = atob(SAMPLE_PNG_BASE64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return new Blob([bytes], { type: 'image/png' });
}
