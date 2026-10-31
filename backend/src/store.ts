import { BillExtractionResponse } from '../../shared/types';
import { MOCK_EXTRACTION } from './mockData';

/**
 * Defensive deep copy so callers can never mutate shared fixtures.
 */
export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

const bills = new Map<string, BillExtractionResponse>();

// Seed the canonical demo bill and return a contract-valid fallback for any id.
export function getBill(id: string): BillExtractionResponse {
  const stored = bills.get(id);
  if (stored) {
    return clone(stored);
  }

  const fallback = clone(MOCK_EXTRACTION);
  fallback.billId = id;
  return fallback;
}

export function saveBill(bill: BillExtractionResponse): BillExtractionResponse {
  bills.set(bill.billId, clone(bill));
  return clone(bill);
}

saveBill(MOCK_EXTRACTION);
