import { BillExtractionResponse } from '../../../shared/types';
import { clone, saveBill } from '../store';

export interface ManualCorrectionInput {
  field?: string;
  itemId?: string;
  itemIndex?: number;
  itemField?: string;
  value?: string | number | null;
}

export interface ManualCorrectionResult {
  bill: BillExtractionResponse;
  applied: boolean;
  warning?: string;
}

function toNumber(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function applyManualCorrection(
  bill: BillExtractionResponse,
  input: ManualCorrectionInput
): ManualCorrectionResult {
  const next = clone(bill);

  if (input.itemId !== undefined || input.itemIndex !== undefined || input.itemField) {
    const index =
      input.itemId !== undefined
        ? next.items.findIndex((item) => item.id === input.itemId)
        : (input.itemIndex ?? -1);

    if (index < 0 || index >= next.items.length) {
      return { bill: next, applied: false, warning: 'Bill item not found.' };
    }

    const item = next.items[index];
    switch (input.itemField) {
      case 'description':
        if (typeof input.value !== 'string' || !input.value.trim()) {
          return { bill: next, applied: false, warning: 'Description must be text.' };
        }
        item.description = input.value.trim();
        break;
      case 'quantity':
        item.quantity = toNumber(input.value);
        break;
      case 'unit':
        item.unit =
          input.value === null || input.value === undefined || input.value === ''
            ? null
            : String(input.value);
        break;
      case 'unitPrice':
        item.unitPrice = toNumber(input.value);
        break;
      case 'lineTotal':
        item.lineTotal = toNumber(input.value);
        break;
      default:
        return { bill: next, applied: false, warning: 'Unknown item field.' };
    }

    if (
      (input.itemField === 'quantity' || input.itemField === 'unitPrice') &&
      item.quantity !== null &&
      item.unitPrice !== null
    ) {
      item.lineTotal = Number((item.quantity * item.unitPrice).toFixed(2));
    }

    item.reviewStatus = 'corrected';
    return { bill: saveBill(next), applied: true };
  }

  switch (input.field) {
    case 'billNumber':
      if (typeof input.value !== 'string' || !input.value.trim()) {
        return { bill: next, applied: false, warning: 'Bill number must be text.' };
      }
      next.fields.billNumber = {
        value: input.value.trim(),
        confidence: 1,
        reviewStatus: 'corrected'
      };
      break;
    case 'billDate':
      if (typeof input.value !== 'string' || !input.value.trim()) {
        return { bill: next, applied: false, warning: 'Bill date must be text.' };
      }
      next.fields.billDate = {
        value: input.value.trim(),
        confidence: 1,
        reviewStatus: 'corrected'
      };
      break;
    case 'customerName':
      if (typeof input.value !== 'string' || !input.value.trim()) {
        return { bill: next, applied: false, warning: 'Customer name must be text.' };
      }
      next.fields.customerName = {
        value: input.value.trim(),
        confidence: 1,
        reviewStatus: 'corrected'
      };
      break;
    case 'grandTotal': {
      const total = toNumber(input.value);
      if (total === null) {
        return { bill: next, applied: false, warning: 'Grand total must be a number.' };
      }
      next.fields.grandTotal = {
        value: total,
        confidence: 1,
        reviewStatus: 'corrected'
      };
      break;
    }
    case 'subtotal': {
      const subtotal = toNumber(input.value);
      if (subtotal === null) {
        return { bill: next, applied: false, warning: 'Subtotal must be a number.' };
      }
      next.fields.subtotal = {
        value: subtotal,
        confidence: 1,
        reviewStatus: 'corrected'
      };
      break;
    }
    case 'taxTotal': {
      const taxTotal = toNumber(input.value);
      if (taxTotal === null) {
        return { bill: next, applied: false, warning: 'Tax total must be a number.' };
      }
      next.fields.taxTotal = {
        value: taxTotal,
        confidence: 1,
        reviewStatus: 'corrected'
      };
      break;
    }
    default:
      return { bill: next, applied: false, warning: 'Unknown bill field.' };
  }

  return { bill: saveBill(next), applied: true };
}
