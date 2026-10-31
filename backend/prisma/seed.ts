import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const BUSINESS_ID = 'demo-business-001';
const DEMO_BILL_ID = 'demo-bill-001';

const customers = [
  { id: 'demo-customer-ravi', name: 'Ravi Kumar', contact: null },
  { id: 'demo-customer-simran', name: 'Simran Kaur', contact: '9876543210' },
  { id: 'demo-customer-aman', name: 'Aman Singh', contact: null }
];

const products = [
  { id: 'demo-product-sugar', name: 'Sugar (Chini)', defaultUnit: 'kg' },
  { id: 'demo-product-rice', name: 'Rice (Basmati)', defaultUnit: 'kg' },
  { id: 'demo-product-oil', name: 'Mustard Oil (Sarson Tel)', defaultUnit: 'litre' },
  { id: 'demo-product-tea', name: 'Tea Leaves (Chai Patti)', defaultUnit: 'g' },
  { id: 'demo-product-atta', name: 'Wheat Flour (Atta)', defaultUnit: 'kg' }
];

const vocabulary = [
  {
    id: 'demo-vocab-chini',
    spokenOrWrittenTerm: 'chini',
    canonicalValue: 'Sugar',
    valueType: 'product',
    confirmedByUser: true
  },
  {
    id: 'demo-vocab-atta',
    spokenOrWrittenTerm: 'atta',
    canonicalValue: 'Wheat Flour',
    valueType: 'product',
    confirmedByUser: true
  },
  {
    id: 'demo-vocab-sarson-tel',
    spokenOrWrittenTerm: 'sarson tel',
    canonicalValue: 'Mustard Oil',
    valueType: 'product',
    confirmedByUser: false
  }
];

async function main() {
  await prisma.business.upsert({
    where: { id: BUSINESS_ID },
    update: { name: 'BahiVerse Kirana', preferredLanguage: 'hi' },
    create: {
      id: BUSINESS_ID,
      name: 'BahiVerse Kirana',
      preferredLanguage: 'hi'
    }
  });

  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      update: {
        businessId: BUSINESS_ID,
        name: customer.name,
        contact: customer.contact
      },
      create: {
        ...customer,
        businessId: BUSINESS_ID
      }
    });
  }

  for (const product of products) {
    await prisma.product.upsert({
      where: { id: product.id },
      update: {
        businessId: BUSINESS_ID,
        name: product.name,
        defaultUnit: product.defaultUnit
      },
      create: {
        ...product,
        businessId: BUSINESS_ID
      }
    });
  }

  for (const mapping of vocabulary) {
    await prisma.vocabularyMapping.upsert({
      where: { id: mapping.id },
      update: {
        businessId: BUSINESS_ID,
        spokenOrWrittenTerm: mapping.spokenOrWrittenTerm,
        canonicalValue: mapping.canonicalValue,
        valueType: mapping.valueType,
        confirmedByUser: mapping.confirmedByUser
      },
      create: {
        ...mapping,
        businessId: BUSINESS_ID
      }
    });
  }

  await prisma.bill.upsert({
    where: { id: DEMO_BILL_ID },
    update: {
      businessId: BUSINESS_ID,
      customerId: 'demo-customer-ravi',
      billNumber: 'B-102',
      billDate: new Date('2026-10-31T00:00:00.000Z'),
      subtotal: null,
      taxTotal: null,
      grandTotal: 336,
      status: 'needs_review'
    },
    create: {
      id: DEMO_BILL_ID,
      businessId: BUSINESS_ID,
      customerId: 'demo-customer-ravi',
      billNumber: 'B-102',
      billDate: new Date('2026-10-31T00:00:00.000Z'),
      subtotal: null,
      taxTotal: null,
      grandTotal: 336,
      status: 'needs_review'
    }
  });

  await prisma.billItem.deleteMany({ where: { billId: DEMO_BILL_ID } });
  await prisma.billItem.create({
    data: {
      id: 'demo-item-001',
      billId: DEMO_BILL_ID,
      productId: 'demo-product-sugar',
      itemDescriptionSnapshot: 'Sugar (Chini)',
      quantity: 5,
      unit: 'kg',
      unitPriceAtTransaction: 42,
      lineTotal: 210,
      reviewStatus: 'pending'
    }
  });

  const counts = {
    businesses: await prisma.business.count(),
    customers: await prisma.customer.count(),
    products: await prisma.product.count(),
    bills: await prisma.bill.count(),
    vocabulary: await prisma.vocabularyMapping.count()
  };

  console.log('[BahiVerse] Seed complete:', counts);
}

main()
  .catch((error) => {
    console.error('[BahiVerse] Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
