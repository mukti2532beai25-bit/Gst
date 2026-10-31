import { Prisma } from '@prisma/client';
import { runWithDatabase } from '../lib/database';
import * as fallback from '../lib/fallbackStore';
import type {
  BillRecord,
  BusinessRecord,
  CreateBillInput,
  CreateVocabularyInput,
  SaveBillInput,
  VocabularyRecord
} from '../types/domain';
import type { ReviewStatus } from '../../../shared/types';

const billInclude = {
  items: true,
  customer: true,
  business: true,
  corrections: true
} satisfies Prisma.BillInclude;

type BillWithRelations = Prisma.BillGetPayload<{ include: typeof billInclude }>;

const businessSelect = {
  id: true,
  name: true,
  preferredLanguage: true
} satisfies Prisma.BusinessSelect;

function decimalToNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  const numeric = typeof value === 'number' ? value : Number(String(value));
  return Number.isFinite(numeric) ? numeric : null;
}

function toDateString(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function normalizeReviewStatus(value: string): ReviewStatus {
  if (value === 'confirmed' || value === 'corrected' || value === 'pending') return value;
  return 'pending';
}

function mapBill(bill: BillWithRelations): BillRecord {
  return {
    id: bill.id,
    businessId: bill.businessId,
    businessPreferredLanguage: bill.business?.preferredLanguage ?? 'hi',
    customerId: bill.customerId,
    customerName: bill.customer?.name ?? null,
    billNumber: bill.billNumber,
    billDate: toDateString(bill.billDate),
    subtotal: decimalToNumber(bill.subtotal),
    taxTotal: decimalToNumber(bill.taxTotal),
    grandTotal: decimalToNumber(bill.grandTotal),
    sourceImageUrl: bill.sourceImageUrl,
    status: bill.status,
    createdAt: bill.createdAt.toISOString(),
    items: bill.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      description: item.itemDescriptionSnapshot,
      quantity: decimalToNumber(item.quantity),
      unit: item.unit,
      unitPrice: decimalToNumber(item.unitPriceAtTransaction),
      lineTotal: decimalToNumber(item.lineTotal),
      reviewStatus: normalizeReviewStatus(item.reviewStatus)
    })),
    corrections: [...bill.corrections]
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
      .map((correction) => ({
        id: correction.id,
        fieldName: correction.fieldName,
        originalValue: correction.originalValue,
        correctedValue: correction.correctedValue,
        correctionSource: correction.correctionSource,
        createdAt: correction.createdAt.toISOString()
      }))
  };
}

function mapBusiness(business: {
  id: string;
  name: string;
  preferredLanguage: string;
}): BusinessRecord {
  return {
    id: business.id,
    name: business.name,
    preferredLanguage: business.preferredLanguage
  };
}

function mapVocabulary(record: {
  id: string;
  businessId: string;
  spokenOrWrittenTerm: string;
  canonicalValue: string;
  valueType: string;
  confirmedByUser: boolean;
  createdAt: Date;
}): VocabularyRecord {
  return {
    id: record.id,
    businessId: record.businessId,
    spokenOrWrittenTerm: record.spokenOrWrittenTerm,
    canonicalValue: record.canonicalValue,
    valueType: record.valueType,
    confirmedByUser: record.confirmedByUser,
    createdAt: record.createdAt.toISOString()
  };
}

export async function findBusiness(id: string): Promise<BusinessRecord | null> {
  const result = await runWithDatabase((db) =>
    db.business.findUnique({ where: { id }, select: businessSelect })
  );
  if (result.ok) return result.value ? mapBusiness(result.value) : null;
  return fallback.getBusiness(id);
}

export async function findFirstBusiness(): Promise<BusinessRecord | null> {
  const result = await runWithDatabase((db) =>
    db.business.findFirst({ orderBy: { createdAt: 'asc' }, select: businessSelect })
  );
  if (result.ok) return result.value ? mapBusiness(result.value) : null;
  return fallback.findFirstBusiness();
}

export async function ensureDemoBusiness(): Promise<BusinessRecord> {
  const existing = await findFirstBusiness();
  if (existing) return existing;

  const created = await runWithDatabase((db) =>
    db.business.create({
      data: {
        id: 'demo-business-001',
        name: 'BahiVerse Kirana',
        preferredLanguage: 'hi'
      },
      select: businessSelect
    })
  );
  if (created.ok) return mapBusiness(created.value);
  return fallback.ensureDemoBusiness();
}

export async function findOrCreateCustomer(
  businessId: string,
  name: string
): Promise<string> {
  const trimmed = name.trim();
  const found = await runWithDatabase((db) =>
    db.customer.findFirst({
      where: { businessId, name: { equals: trimmed, mode: 'insensitive' } },
      select: { id: true }
    })
  );

  if (found.ok) {
    if (found.value) return found.value.id;
    const created = await runWithDatabase((db) =>
      db.customer.create({
        data: { businessId, name: trimmed },
        select: { id: true }
      })
    );
    if (created.ok) return created.value.id;
  }

  return fallback.findCustomerByName(businessId, trimmed) ?? fallback.createCustomer(businessId, trimmed);
}

export async function findCustomerById(
  businessId: string,
  customerId: string
): Promise<{ id: string; name: string } | null> {
  const found = await runWithDatabase((db) =>
    db.customer.findFirst({
      where: { id: customerId, businessId },
      select: { id: true, name: true }
    })
  );
  if (found.ok) return found.value;
  return fallback.findCustomerById(businessId, customerId);
}

export async function findProductIdByName(
  businessId: string,
  name: string
): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;

  const found = await runWithDatabase((db) =>
    db.product.findFirst({
      where: { businessId, name: { equals: trimmed, mode: 'insensitive' } },
      select: { id: true }
    })
  );
  if (found.ok) return found.value?.id ?? null;
  return fallback.findProductByName(businessId, trimmed);
}

export async function findBillById(id: string): Promise<BillRecord | null> {
  const result = await runWithDatabase((db) =>
    db.bill.findUnique({ where: { id }, include: billInclude })
  );
  if (result.ok) return result.value ? mapBill(result.value) : null;
  return fallback.findBill(id);
}

export async function createBill(input: CreateBillInput): Promise<BillRecord> {
  const result = await runWithDatabase((db) =>
    db.bill.create({
      data: {
        businessId: input.businessId,
        customerId: input.customerId,
        billNumber: input.billNumber,
        billDate: input.billDate ? new Date(input.billDate) : null,
        subtotal: input.subtotal,
        taxTotal: input.taxTotal,
        grandTotal: input.grandTotal,
        sourceImageUrl: input.sourceImageUrl,
        status: input.status,
        items: {
          create: input.items.map((item) => ({
            productId: item.productId ?? null,
            itemDescriptionSnapshot: item.description,
            quantity: item.quantity,
            unit: item.unit,
            unitPriceAtTransaction: item.unitPrice,
            lineTotal: item.lineTotal,
            reviewStatus: item.reviewStatus
          }))
        }
      },
      include: billInclude
    })
  );
  if (result.ok) return mapBill(result.value);
  return fallback.createDraftBill(input);
}

export async function saveBill(id: string, input: SaveBillInput): Promise<BillRecord | null> {
  const result = await runWithDatabase((db) =>
    db.$transaction(async (tx) => {
      const existing = await tx.bill.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return null;

      const data: Prisma.BillUpdateInput = {};
      if (input.billNumber !== undefined) data.billNumber = input.billNumber;
      if (input.billDate !== undefined) {
        data.billDate = input.billDate ? new Date(input.billDate) : null;
      }
      if (input.subtotal !== undefined) data.subtotal = input.subtotal;
      if (input.taxTotal !== undefined) data.taxTotal = input.taxTotal;
      if (input.grandTotal !== undefined) data.grandTotal = input.grandTotal;
      if (input.status !== undefined) data.status = input.status;
      if (input.customerId !== undefined) {
        data.customer = input.customerId
          ? { connect: { id: input.customerId } }
          : { disconnect: true };
      }

      await tx.bill.update({ where: { id }, data });

      if (input.items !== undefined) {
        await tx.billItem.deleteMany({ where: { billId: id } });
        if (input.items.length > 0) {
          await tx.billItem.createMany({
            data: input.items.map((item) => ({
              billId: id,
              productId: item.productId ?? null,
              itemDescriptionSnapshot: item.description,
              quantity: item.quantity,
              unit: item.unit,
              unitPriceAtTransaction: item.unitPrice,
              lineTotal: item.lineTotal,
              reviewStatus: item.reviewStatus
            }))
          });
        }
      }

      if (input.corrections.length > 0) {
        await tx.correction.createMany({
          data: input.corrections.map((correction) => ({
            billId: id,
            fieldName: correction.fieldName,
            originalValue: correction.originalValue,
            correctedValue: correction.correctedValue,
            correctionSource: 'manual'
          }))
        });
      }

      return tx.bill.findUnique({ where: { id }, include: billInclude });
    })
  );

  if (result.ok) return result.value ? mapBill(result.value) : null;
  return fallback.saveBill(id, input);
}

export async function confirmBill(id: string): Promise<BillRecord | null> {
  const result = await runWithDatabase((db) =>
    db.$transaction(async (tx) => {
      const existing = await tx.bill.findUnique({ where: { id }, select: { id: true } });
      if (!existing) return null;

      await tx.bill.update({ where: { id }, data: { status: 'confirmed' } });
      await tx.billItem.updateMany({
        where: { billId: id, reviewStatus: 'pending' },
        data: { reviewStatus: 'confirmed' }
      });

      return tx.bill.findUnique({ where: { id }, include: billInclude });
    })
  );

  if (result.ok) return result.value ? mapBill(result.value) : null;
  return fallback.confirmBill(id);
}

export async function listVocabulary(businessId: string): Promise<VocabularyRecord[]> {
  const result = await runWithDatabase((db) =>
    db.vocabularyMapping.findMany({
      where: { businessId },
      orderBy: { createdAt: 'desc' }
    })
  );
  if (result.ok) return result.value.map(mapVocabulary);
  return fallback.listVocabulary(businessId);
}

export async function createVocabulary(
  businessId: string,
  input: CreateVocabularyInput
): Promise<VocabularyRecord> {
  const result = await runWithDatabase((db) =>
    db.vocabularyMapping.create({
      data: {
        businessId,
        spokenOrWrittenTerm: input.spokenOrWrittenTerm.trim(),
        canonicalValue: input.canonicalValue.trim(),
        valueType: input.valueType.trim(),
        confirmedByUser: input.confirmedByUser ?? false
      }
    })
  );
  if (result.ok) return mapVocabulary(result.value);
  return fallback.createVocabulary(businessId, input);
}
