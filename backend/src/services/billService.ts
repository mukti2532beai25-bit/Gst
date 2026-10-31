import type { BillExtractionResponse, ReviewStatus } from '../../../shared/types';
import * as repository from '../repositories/billRepository';
import type {
  BillRecord,
  NewBillItemInput,
  SaveBillInput
} from '../types/domain';
import { HttpError } from '../utils/http';
import {
  asRecord,
  parseOptionalDate,
  parseOptionalNumber,
  parseOptionalString,
  parseReviewStatus
} from '../utils/validation';
import { lineItemsTotal, roundMoney, toExtractionResponse } from './billMapper';
import { buildExport, type ExportResult } from './exportService';
import { generateNormalization } from './normalizationService';

interface ParsedItem extends NewBillItemInput {
  reviewStatusProvided: boolean;
}

interface UploadParams {
  imageUrl: string;
  body: Record<string, unknown>;
}

function sameValue(a: string | number | null, b: string | number | null): boolean {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) < 0.005;
  }
  const normalizedA = a === null ? null : String(a);
  const normalizedB = b === null ? null : String(b);
  return normalizedA === normalizedB;
}

function toText(value: string | number | null): string | null {
  return value === null ? null : String(value);
}

function parseItems(value: unknown): ParsedItem[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new HttpError(400, 'items must be an array.');
  }

  return value.map((raw, index) => {
    const record = asRecord(raw, `items[${index}]`);
    const description = parseOptionalString(
      record.description ?? record.itemDescription ?? record.itemDescriptionSnapshot,
      `items[${index}].description`
    );
    if (!description) {
      throw new HttpError(400, `items[${index}].description is required.`);
    }

    const quantity = parseOptionalNumber(record.quantity, `items[${index}].quantity`) ?? null;
    const unit = parseOptionalString(record.unit, `items[${index}].unit`) ?? null;
    const unitPrice =
      parseOptionalNumber(
        record.unitPrice ?? record.unitPriceAtTransaction,
        `items[${index}].unitPrice`
      ) ?? null;
    let lineTotal = parseOptionalNumber(record.lineTotal, `items[${index}].lineTotal`) ?? null;

    if (lineTotal === null && quantity !== null && unitPrice !== null) {
      lineTotal = roundMoney(quantity * unitPrice);
    }

    const reviewStatus = parseReviewStatus(
      record.reviewStatus,
      `items[${index}].reviewStatus`
    );
    const productId = parseOptionalString(record.productId, `items[${index}].productId`) ?? null;

    return {
      id: typeof record.id === 'string' ? record.id : undefined,
      productId,
      description,
      quantity,
      unit,
      unitPrice,
      lineTotal,
      reviewStatus: reviewStatus ?? 'pending',
      reviewStatusProvided: reviewStatus !== undefined
    };
  });
}

async function resolveBusiness(preferredBusinessId?: string) {
  if (preferredBusinessId) {
    const business = await repository.findBusiness(preferredBusinessId);
    if (!business) throw new HttpError(404, 'Business not found.');
    return business;
  }
  const existing = await repository.findFirstBusiness();
  if (existing) return existing;
  return repository.ensureDemoBusiness();
}

async function resolveProductIds(
  businessId: string,
  items: ParsedItem[]
): Promise<ParsedItem[]> {
  const resolved: ParsedItem[] = [];
  for (const item of items) {
    const productId =
      item.productId ?? (await repository.findProductIdByName(businessId, item.description));
    resolved.push({ ...item, productId });
  }
  return resolved;
}

function itemChanged(previous: NewBillItemInput, next: NewBillItemInput): boolean {
  return (
    previous.description !== next.description ||
    !sameValue(previous.quantity, next.quantity) ||
    previous.unit !== next.unit ||
    !sameValue(previous.unitPrice, next.unitPrice) ||
    !sameValue(previous.lineTotal, next.lineTotal)
  );
}

export async function createUploadedBill(params: UploadParams): Promise<BillRecord> {
  const body = params.body;
  const preferredBusinessId = parseOptionalString(body.businessId, 'businessId') ?? undefined;
  const business = await resolveBusiness(preferredBusinessId);

  const customerName = parseOptionalString(body.customerName, 'customerName');
  const billNumber = parseOptionalString(body.billNumber, 'billNumber');
  const billDate = parseOptionalDate(body.billDate, 'billDate');
  const subtotal = parseOptionalNumber(body.subtotal, 'subtotal');
  const taxTotal = parseOptionalNumber(body.taxTotal, 'taxTotal');
  const grandTotal = parseOptionalNumber(body.grandTotal, 'grandTotal');

  let customerId: string | null = null;
  if (customerName) {
    customerId = await repository.findOrCreateCustomer(business.id, customerName);
  }

  return repository.createBill({
    businessId: business.id,
    customerId,
    customerName: customerName ?? null,
    billNumber: billNumber ?? null,
    billDate: billDate ?? null,
    subtotal: subtotal ?? null,
    taxTotal: taxTotal ?? null,
    grandTotal: grandTotal ?? null,
    sourceImageUrl: params.imageUrl,
    status: 'needs_review',
    items: []
  });
}

export async function getBillOrThrow(id: string): Promise<BillRecord> {
  const bill = await repository.findBillById(id);
  if (!bill) throw new HttpError(404, 'Bill not found.');
  return bill;
}

export async function getBillResponse(id: string): Promise<BillExtractionResponse> {
  return toExtractionResponse(await getBillOrThrow(id));
}

export async function patchBill(
  id: string,
  rawBody: unknown
): Promise<BillExtractionResponse> {
  const body = asRecord(rawBody);
  const bill = await getBillOrThrow(id);

  const billNumber = parseOptionalString(body.billNumber, 'billNumber');
  const billDate = parseOptionalDate(body.billDate, 'billDate');
  const subtotalInput = parseOptionalNumber(body.subtotal, 'subtotal');
  const taxTotalInput = parseOptionalNumber(body.taxTotal, 'taxTotal');
  const grandTotalInput = parseOptionalNumber(body.grandTotal, 'grandTotal');
  const customerNameInput = parseOptionalString(body.customerName, 'customerName');
  const customerIdInput = parseOptionalString(body.customerId, 'customerId');
  const parsedItems = parseItems(body.items);

  let finalCustomerId = bill.customerId;
  let finalCustomerName = bill.customerName;
  let customerTouched = false;

  if (customerIdInput !== undefined) {
    customerTouched = true;
    if (customerIdInput === null) {
      finalCustomerId = null;
      finalCustomerName = null;
    } else {
      const customer = await repository.findCustomerById(bill.businessId, customerIdInput);
      if (!customer) {
        throw new HttpError(400, 'customerId does not belong to this business.');
      }
      finalCustomerId = customer.id;
      finalCustomerName = customer.name;
    }
  } else if (customerNameInput !== undefined) {
    customerTouched = true;
    if (customerNameInput === null) {
      finalCustomerId = null;
      finalCustomerName = null;
    } else {
      finalCustomerId = await repository.findOrCreateCustomer(
        bill.businessId,
        customerNameInput
      );
      finalCustomerName = customerNameInput;
    }
  }

  let finalItems: NewBillItemInput[] | undefined;
  if (parsedItems !== undefined) {
    const withProducts = await resolveProductIds(bill.businessId, parsedItems);
    finalItems = withProducts.map((item, index) => {
      const previous = bill.items[index];
      let reviewStatus: ReviewStatus;

      if (item.reviewStatusProvided) {
        reviewStatus = item.reviewStatus;
      } else if (!previous) {
        reviewStatus = 'pending';
      } else if (itemChanged(previous, item)) {
        reviewStatus = 'corrected';
      } else {
        reviewStatus = previous.reviewStatus;
      }

      return {
        id: item.id,
        productId: item.productId,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: item.unitPrice,
        lineTotal: item.lineTotal,
        reviewStatus
      };
    });
  }

  const finalBillNumber = billNumber !== undefined ? billNumber : bill.billNumber;
  const finalBillDate = billDate !== undefined ? billDate : bill.billDate;
  let finalSubtotal = subtotalInput !== undefined ? subtotalInput : bill.subtotal;
  const finalTaxTotal = taxTotalInput !== undefined ? taxTotalInput : bill.taxTotal;
  let finalGrandTotal = grandTotalInput !== undefined ? grandTotalInput : bill.grandTotal;

  if (finalItems !== undefined) {
    if (subtotalInput === undefined) finalSubtotal = lineItemsTotal(finalItems);
    if (grandTotalInput === undefined) {
      finalGrandTotal = roundMoney((finalSubtotal ?? 0) + (finalTaxTotal ?? 0));
    }
  } else if (
    (subtotalInput !== undefined || taxTotalInput !== undefined) &&
    grandTotalInput === undefined &&
    finalSubtotal !== null
  ) {
    finalGrandTotal = roundMoney(finalSubtotal + (finalTaxTotal ?? 0));
  }

  const corrections: SaveBillInput['corrections'] = [];
  const recordCorrection = (
    fieldName: string,
    previous: string | number | null,
    next: string | number | null
  ) => {
    if (!sameValue(previous, next)) {
      corrections.push({
        fieldName,
        originalValue: toText(previous),
        correctedValue: toText(next) ?? ''
      });
    }
  };

  recordCorrection('billNumber', bill.billNumber, finalBillNumber);
  recordCorrection('billDate', bill.billDate, finalBillDate);
  if (customerTouched) {
    recordCorrection('customerName', bill.customerName, finalCustomerName);
  }
  recordCorrection('subtotal', bill.subtotal, finalSubtotal);
  recordCorrection('taxTotal', bill.taxTotal, finalTaxTotal);
  recordCorrection('grandTotal', bill.grandTotal, finalGrandTotal);

  if (finalItems !== undefined) {
    finalItems.forEach((item, index) => {
      const previous = bill.items[index];
      if (!previous) return;

      const fieldCorrections: Array<[string, string | number | null, string | number | null]> = [
        ['description', previous.description, item.description],
        ['quantity', previous.quantity, item.quantity],
        ['unit', previous.unit, item.unit],
        ['unitPrice', previous.unitPrice, item.unitPrice],
        ['lineTotal', previous.lineTotal, item.lineTotal]
      ];

      for (const [fieldName, previousValue, nextValue] of fieldCorrections) {
        recordCorrection(`items[${index}].${fieldName}`, previousValue, nextValue);
      }
    });
  }

  const saveInput: SaveBillInput = {
    billNumber: finalBillNumber,
    billDate: finalBillDate,
    customerId: finalCustomerId,
    subtotal: finalSubtotal,
    taxTotal: finalTaxTotal,
    grandTotal: finalGrandTotal,
    corrections
  };
  if (finalItems !== undefined) saveInput.items = finalItems;

  const updated = await repository.saveBill(id, saveInput);
  if (!updated) throw new HttpError(404, 'Bill not found.');
  return toExtractionResponse(updated);
}

export async function confirmBill(id: string): Promise<BillExtractionResponse> {
  const confirmed = await repository.confirmBill(id);
  if (!confirmed) throw new HttpError(404, 'Bill not found.');
  return toExtractionResponse(confirmed);
}

export async function getNormalization(id: string) {
  const bill = await getBillOrThrow(id);
  return generateNormalization(bill);
}

export async function exportBill(id: string, format: 'csv' | 'json'): Promise<ExportResult> {
  const bill = await getBillOrThrow(id);
  return buildExport(bill, format);
}
