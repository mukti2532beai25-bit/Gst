import { randomUUID } from 'crypto';
import { MOCK_EXTRACTION } from '../mockData';
import type {
  BillRecord,
  BusinessRecord,
  CreateBillInput,
  CreateVocabularyInput,
  SaveBillInput,
  VocabularyRecord
} from '../types/domain';

const DEMO_BUSINESS_ID = 'demo-business-001';
const DEMO_CUSTOMER_ID = 'demo-customer-ravi';
const DEMO_PRODUCT_ID = 'demo-product-sugar';

const nowIso = () => new Date().toISOString();

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

const businesses: BusinessRecord[] = [
  {
    id: DEMO_BUSINESS_ID,
    name: 'BahiVerse Kirana',
    preferredLanguage: 'hi'
  }
];

const customers = [
  { id: DEMO_CUSTOMER_ID, businessId: DEMO_BUSINESS_ID, name: 'Ravi Kumar', contact: null },
  { id: 'demo-customer-simran', businessId: DEMO_BUSINESS_ID, name: 'Simran Kaur', contact: null },
  { id: 'demo-customer-aman', businessId: DEMO_BUSINESS_ID, name: 'Aman Singh', contact: null }
];

const products = [
  { id: DEMO_PRODUCT_ID, businessId: DEMO_BUSINESS_ID, name: 'Sugar (Chini)', defaultUnit: 'kg' },
  { id: 'demo-product-rice', businessId: DEMO_BUSINESS_ID, name: 'Rice (Basmati)', defaultUnit: 'kg' },
  { id: 'demo-product-oil', businessId: DEMO_BUSINESS_ID, name: 'Mustard Oil (Sarson Tel)', defaultUnit: 'litre' },
  { id: 'demo-product-tea', businessId: DEMO_BUSINESS_ID, name: 'Tea Leaves (Chai Patti)', defaultUnit: 'g' },
  { id: 'demo-product-atta', businessId: DEMO_BUSINESS_ID, name: 'Wheat Flour (Atta)', defaultUnit: 'kg' }
];

const demoItem = MOCK_EXTRACTION.items[0];

const bills: BillRecord[] = [
  {
    id: 'demo-bill-001',
    businessId: DEMO_BUSINESS_ID,
    businessPreferredLanguage: 'hi',
    customerId: DEMO_CUSTOMER_ID,
    customerName: MOCK_EXTRACTION.fields.customerName.value,
    billNumber: MOCK_EXTRACTION.fields.billNumber.value,
    billDate: MOCK_EXTRACTION.fields.billDate.value,
    subtotal: null,
    taxTotal: null,
    grandTotal: MOCK_EXTRACTION.fields.grandTotal.value,
    sourceImageUrl: null,
    status: 'needs_review',
    createdAt: nowIso(),
    items: [
      {
        id: 'demo-item-001',
        productId: DEMO_PRODUCT_ID,
        description: demoItem.description,
        quantity: demoItem.quantity,
        unit: demoItem.unit,
        unitPrice: demoItem.unitPrice,
        lineTotal: demoItem.lineTotal,
        reviewStatus: demoItem.reviewStatus
      }
    ],
    corrections: []
  }
];

const vocabulary: VocabularyRecord[] = [
  {
    id: 'demo-vocab-chini',
    businessId: DEMO_BUSINESS_ID,
    spokenOrWrittenTerm: 'chini',
    canonicalValue: 'Sugar',
    valueType: 'product',
    confirmedByUser: true,
    createdAt: nowIso()
  },
  {
    id: 'demo-vocab-atta',
    businessId: DEMO_BUSINESS_ID,
    spokenOrWrittenTerm: 'atta',
    canonicalValue: 'Wheat Flour',
    valueType: 'product',
    confirmedByUser: true,
    createdAt: nowIso()
  }
];

export function listBusinesses(): BusinessRecord[] {
  return clone(businesses);
}

export function getBusiness(id: string): BusinessRecord | null {
  const business = businesses.find((item) => item.id === id);
  return business ? clone(business) : null;
}

export function findFirstBusiness(): BusinessRecord | null {
  return businesses.length > 0 ? clone(businesses[0]) : null;
}

export function ensureDemoBusiness(): BusinessRecord {
  const existing = findFirstBusiness();
  if (existing) return existing;
  const business: BusinessRecord = {
    id: DEMO_BUSINESS_ID,
    name: 'BahiVerse Kirana',
    preferredLanguage: 'hi'
  };
  businesses.push(business);
  return clone(business);
}

export function findCustomerById(
  businessId: string,
  customerId: string
): { id: string; name: string } | null {
  const match = customers.find(
    (customer) => customer.businessId === businessId && customer.id === customerId
  );
  return match ? { id: match.id, name: match.name } : null;
}

export function findCustomerByName(businessId: string, name: string): string | null {
  const match = customers.find(
    (customer) =>
      customer.businessId === businessId && customer.name.toLowerCase() === name.trim().toLowerCase()
  );
  return match ? match.id : null;
}

export function createCustomer(businessId: string, name: string): string {
  const customer = {
    id: randomUUID(),
    businessId,
    name: name.trim(),
    contact: null
  };
  customers.push(customer);
  return customer.id;
}

export function findProductByName(businessId: string, name: string): string | null {
  const match = products.find(
    (product) =>
      product.businessId === businessId && product.name.toLowerCase() === name.trim().toLowerCase()
  );
  return match ? match.id : null;
}

export function createDraftBill(input: CreateBillInput): BillRecord {
  const business = businesses.find((item) => item.id === input.businessId);
  const customer = input.customerId
    ? customers.find((item) => item.id === input.customerId)
    : null;

  const bill: BillRecord = {
    id: randomUUID(),
    businessId: input.businessId,
    businessPreferredLanguage: business?.preferredLanguage ?? 'hi',
    customerId: input.customerId,
    customerName: input.customerName ?? customer?.name ?? null,
    billNumber: input.billNumber,
    billDate: input.billDate,
    subtotal: input.subtotal,
    taxTotal: input.taxTotal,
    grandTotal: input.grandTotal,
    sourceImageUrl: input.sourceImageUrl,
    status: input.status,
    createdAt: nowIso(),
    items: input.items.map((item) => ({
      id: item.id ?? randomUUID(),
      productId: item.productId ?? null,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      reviewStatus: item.reviewStatus
    })),
    corrections: []
  };

  bills.unshift(bill);
  return clone(bill);
}

export function findBill(id: string): BillRecord | null {
  const bill = bills.find((item) => item.id === id);
  return bill ? clone(bill) : null;
}

export function saveBill(id: string, input: SaveBillInput): BillRecord | null {
  const bill = bills.find((item) => item.id === id);
  if (!bill) return null;

  if (input.billNumber !== undefined) bill.billNumber = input.billNumber;
  if (input.billDate !== undefined) bill.billDate = input.billDate;
  if (input.subtotal !== undefined) bill.subtotal = input.subtotal;
  if (input.taxTotal !== undefined) bill.taxTotal = input.taxTotal;
  if (input.grandTotal !== undefined) bill.grandTotal = input.grandTotal;
  if (input.status !== undefined) bill.status = input.status;

  if (input.customerId !== undefined) {
    bill.customerId = input.customerId;
    const customer = input.customerId
      ? customers.find((item) => item.id === input.customerId)
      : null;
    bill.customerName = customer?.name ?? null;
  }

  if (input.items !== undefined) {
    bill.items = input.items.map((item) => ({
      id: item.id ?? randomUUID(),
      productId: item.productId ?? null,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      reviewStatus: item.reviewStatus
    }));
  }

  for (const correction of input.corrections) {
    bill.corrections.push({
      id: randomUUID(),
      fieldName: correction.fieldName,
      originalValue: correction.originalValue,
      correctedValue: correction.correctedValue,
      correctionSource: 'manual',
      createdAt: nowIso()
    });
  }

  return clone(bill);
}

export function confirmBill(id: string): BillRecord | null {
  const bill = bills.find((item) => item.id === id);
  if (!bill) return null;
  bill.status = 'confirmed';
  bill.items = bill.items.map((item) => ({
    ...item,
    reviewStatus: item.reviewStatus === 'pending' ? 'confirmed' : item.reviewStatus
  }));
  return clone(bill);
}

export function listVocabulary(businessId: string): VocabularyRecord[] {
  return clone(vocabulary.filter((item) => item.businessId === businessId));
}

export function createVocabulary(
  businessId: string,
  input: CreateVocabularyInput
): VocabularyRecord {
  const record: VocabularyRecord = {
    id: randomUUID(),
    businessId,
    spokenOrWrittenTerm: input.spokenOrWrittenTerm.trim(),
    canonicalValue: input.canonicalValue.trim(),
    valueType: input.valueType.trim(),
    confirmedByUser: input.confirmedByUser ?? false,
    createdAt: nowIso()
  };
  vocabulary.unshift(record);
  return clone(record);
}
