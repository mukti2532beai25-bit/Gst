import type { BillExtractionResponse } from '@shared/types';

export type ReviewFieldKey =
  | 'billNumber'
  | 'billDate'
  | 'customerName'
  | 'grandTotal';

export interface ReviewFieldMeta {
  key: ReviewFieldKey;
  label: string;
  inputType: 'text' | 'date' | 'number';
  placeholder: string;
  numeric?: boolean;
}

export const REVIEW_FIELDS: ReviewFieldMeta[] = [
  {
    key: 'billNumber',
    label: 'Bill number',
    inputType: 'text',
    placeholder: 'e.g. B-102'
  },
  {
    key: 'billDate',
    label: 'Bill date',
    inputType: 'date',
    placeholder: 'YYYY-MM-DD'
  },
  {
    key: 'customerName',
    label: 'Customer name',
    inputType: 'text',
    placeholder: 'Customer name'
  },
  {
    key: 'grandTotal',
    label: 'Grand total',
    inputType: 'number',
    placeholder: '0.00',
    numeric: true
  }
];

export const round2 = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;

const inr = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 2,
  minimumFractionDigits: 0
});

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return inr.format(value);
}

export function itemsTotal(bill: BillExtractionResponse): number {
  return round2(
    bill.items.reduce((sum, item) => {
      const line = item.lineTotal ?? (item.quantity ?? 0) * (item.unitPrice ?? 0);
      return sum + (Number.isFinite(line) ? line : 0);
    }, 0)
  );
}

export function arithmeticMismatch(bill: BillExtractionResponse): {
  expected: number;
  actual: number;
  difference: number;
  hasMismatch: boolean;
} {
  const expected = itemsTotal(bill);
  const actual = bill.fields.grandTotal.value ?? 0;
  const difference = round2(actual - expected);
  return {
    expected,
    actual,
    difference,
    hasMismatch: Math.abs(difference) > 0.5
  };
}

export function lineMismatchCount(bill: BillExtractionResponse): number {
  return bill.items.filter((item) => {
    if (item.quantity === null || item.unitPrice === null || item.lineTotal === null) {
      return false;
    }
    return Math.abs(round2(item.quantity * item.unitPrice) - item.lineTotal) > 0.5;
  }).length;
}

export function cleanTranscript(
  raw: string,
  key: ReviewFieldKey
): string | number | null {
  const transcript = raw.trim();
  if (!transcript) return null;

  if (key === 'grandTotal') {
    const matches = transcript.match(/-?\d+(?:[.,]\d+)?/g);
    if (!matches || matches.length === 0) return null;
    const value = Number(matches[matches.length - 1].replace(',', '.'));
    return Number.isFinite(value) ? value : null;
  }

  if (key === 'billDate') {
    const iso = transcript.match(/\d{4}-\d{2}-\d{2}/);
    if (iso) return iso[0];
    const local = transcript.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
    if (local) {
      const day = local[1].padStart(2, '0');
      const month = local[2].padStart(2, '0');
      const year = local[3].length === 2 ? `20${local[3]}` : local[3];
      return `${year}-${month}-${day}`;
    }
    return null;
  }

  const cleaned = transcript
    .replace(
      /^(?:please\s+)?(?:set\s+)?(?:the\s+)?(?:bill\s+number|customer\s+name|bill\s+date|grand\s+total)\s*(?:is|to|=|:)?\s*/i,
      ''
    )
    .trim();

  return cleaned.length > 0 ? cleaned : null;
}
