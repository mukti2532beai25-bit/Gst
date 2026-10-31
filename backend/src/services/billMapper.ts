import type {
  BillExtractionResponse,
  ExtractedBillItem,
  FieldItem,
  ReviewStatus
} from '../../../shared/types';
import type { BillRecord } from '../types/domain';

const FIELD_BASE_CONFIDENCE: Record<string, number> = {
  billNumber: 0.92,
  billDate: 0.9,
  customerName: 0.86,
  grandTotal: 0.82,
  subtotal: 0.88,
  taxTotal: 0.87
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function toLanguage(value: string): 'en' | 'hi' | 'pa' {
  if (value === 'en' || value === 'pa') return value;
  return 'hi';
}

export interface LineItemLike {
  lineTotal: number | null;
  quantity: number | null;
  unitPrice: number | null;
}

export function itemLineTotal(item: LineItemLike): number {
  if (item.lineTotal !== null) return item.lineTotal;
  if (item.quantity !== null && item.unitPrice !== null) {
    return roundMoney(item.quantity * item.unitPrice);
  }
  return 0;
}

export function lineItemsTotal(items: LineItemLike[]): number {
  return roundMoney(items.reduce((sum, item) => sum + itemLineTotal(item), 0));
}

export function computeWarnings(bill: BillRecord): string[] {
  const warnings: string[] = [];
  const itemsTotal = lineItemsTotal(bill.items);

  if (
    bill.items.length > 0 &&
    bill.grandTotal !== null &&
    Math.abs(itemsTotal - bill.grandTotal) > 0.01
  ) {
    warnings.push('Calculated line items total does not match bill grand total.');
  }

  if (bill.subtotal !== null && bill.grandTotal !== null) {
    const expected = roundMoney(bill.subtotal + (bill.taxTotal ?? 0));
    if (Math.abs(expected - bill.grandTotal) > 0.01) {
      warnings.push('Subtotal plus tax does not match the recorded grand total.');
    }
  }

  if (!bill.billNumber) warnings.push('Bill number is missing.');
  if (!bill.billDate) warnings.push('Bill date is missing.');
  if (!bill.customerName) warnings.push('Customer name is missing.');
  if (bill.grandTotal === null) warnings.push('Grand total is missing.');

  const incompleteItems = bill.items.filter(
    (item) =>
      item.quantity === null ||
      item.unitPrice === null ||
      item.lineTotal === null ||
      !item.description
  );
  if (incompleteItems.length > 0) {
    warnings.push('Some line items are missing a description, quantity, unit price, or line total.');
  }

  if (bill.items.some((item) => item.reviewStatus === 'pending')) {
    warnings.push('Some line items still need review.');
  }

  if (bill.status !== 'confirmed') {
    warnings.push('Bill is awaiting confirmation.');
  }

  return warnings;
}

function buildField<T extends string | number>(
  value: T | null,
  fieldName: string,
  correctedFields: Set<string>,
  confirmed: boolean
): FieldItem<T> {
  const normalized = typeof value === 'string' ? value.trim() : value;
  const isEmpty = normalized === null || normalized === '';

  let reviewStatus: ReviewStatus = 'pending';
  if (isEmpty) {
    reviewStatus = 'pending';
  } else if (correctedFields.has(fieldName)) {
    reviewStatus = 'corrected';
  } else if (confirmed) {
    reviewStatus = 'confirmed';
  }

  let confidence = 0;
  if (!isEmpty) {
    if (reviewStatus === 'confirmed') confidence = 1;
    else if (reviewStatus === 'corrected') confidence = 0.97;
    else confidence = FIELD_BASE_CONFIDENCE[fieldName] ?? 0.85;
  }

  return {
    value: isEmpty ? null : (normalized as T),
    confidence,
    reviewStatus
  };
}

export function toExtractionResponse(bill: BillRecord): BillExtractionResponse {
  const correctedFields = new Set(bill.corrections.map((correction) => correction.fieldName));
  const confirmed = bill.status === 'confirmed';

  const items: ExtractedBillItem[] = bill.items.map((item) => ({
    id: item.id,
    description: item.description,
    quantity: item.quantity,
    unit: item.unit,
    unitPrice: item.unitPrice,
    lineTotal: item.lineTotal ?? (item.quantity !== null && item.unitPrice !== null ? roundMoney(item.quantity * item.unitPrice) : null),
    reviewStatus: item.reviewStatus
  }));

  return {
    billId: bill.id,
    status: confirmed ? 'confirmed' : 'needs_review',
    language: toLanguage(bill.businessPreferredLanguage),
    fields: {
      billNumber: buildField(bill.billNumber, 'billNumber', correctedFields, confirmed),
      billDate: buildField(bill.billDate, 'billDate', correctedFields, confirmed),
      customerName: buildField(bill.customerName, 'customerName', correctedFields, confirmed),
      grandTotal: buildField(bill.grandTotal, 'grandTotal', correctedFields, confirmed),
      subtotal: buildField(bill.subtotal, 'subtotal', correctedFields, confirmed),
      taxTotal: buildField(bill.taxTotal, 'taxTotal', correctedFields, confirmed)
    },
    items,
    warnings: computeWarnings(bill)
  };
}
