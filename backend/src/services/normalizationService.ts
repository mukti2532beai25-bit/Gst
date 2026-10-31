import type {
  FunctionalDependency,
  NormalizationRelationship,
  NormalizationResponse,
  NormalizationTable
} from '../../../shared/types';
import { MOCK_NORMALIZATION } from '../mockData';
import type { BillRecord } from '../types/domain';

function buildTables(): NormalizationTable[] {
  return [
    {
      name: 'Customers',
      fields: [
        { name: 'customer_id', type: 'id', primaryKey: true },
        { name: 'customer_name', type: 'string' },
        { name: 'contact', type: 'string' }
      ]
    },
    {
      name: 'Bills',
      fields: [
        { name: 'bill_id', type: 'id', primaryKey: true },
        { name: 'customer_id', type: 'id', foreignKey: 'Customers.customer_id' },
        { name: 'bill_number', type: 'string' },
        { name: 'bill_date', type: 'date' },
        { name: 'subtotal', type: 'decimal' },
        { name: 'tax_total', type: 'decimal' },
        { name: 'grand_total', type: 'decimal' },
        { name: 'status', type: 'string' }
      ]
    },
    {
      name: 'BillItems',
      fields: [
        { name: 'bill_item_id', type: 'id', primaryKey: true },
        { name: 'bill_id', type: 'id', foreignKey: 'Bills.bill_id' },
        { name: 'product_id', type: 'id', foreignKey: 'Products.product_id' },
        { name: 'description', type: 'string' },
        { name: 'quantity', type: 'decimal' },
        { name: 'unit', type: 'string' },
        { name: 'unit_price', type: 'decimal' },
        { name: 'line_total', type: 'decimal' },
        { name: 'review_status', type: 'string' }
      ]
    },
    {
      name: 'Products',
      fields: [
        { name: 'product_id', type: 'id', primaryKey: true },
        { name: 'product_name', type: 'string' },
        { name: 'default_unit', type: 'string' }
      ]
    }
  ];
}

function buildRelationships(): NormalizationRelationship[] {
  return [
    { from: 'Bills.customer_id', to: 'Customers.customer_id', label: 'many-to-one' },
    { from: 'BillItems.bill_id', to: 'Bills.bill_id', label: 'many-to-one' },
    { from: 'BillItems.product_id', to: 'Products.product_id', label: 'many-to-one' }
  ];
}

function buildDependencies(bill: BillRecord): FunctionalDependency[] {
  const dependencies: FunctionalDependency[] = [
    {
      determinant: ['customer_id'],
      dependent: ['customer_name', 'contact'],
      status: 'inferred',
      explanation:
        'Within the observed bills, customer_id deterministically maps to one customer_name and contact value.'
    },
    {
      determinant: ['product_id'],
      dependent: ['product_name', 'default_unit'],
      status: 'inferred',
      explanation:
        'A product is described by a single canonical name and default unit, so product_id determines both.'
    },
    {
      determinant: ['bill_id'],
      dependent: ['customer_id', 'bill_number', 'bill_date', 'grand_total'],
      status: 'inferred',
      explanation:
        'Each bill has exactly one customer, number, date, and grand total, so bill_id determines those attributes.'
    },
    {
      determinant: ['bill_item_id'],
      dependent: ['bill_id', 'product_id', 'quantity', 'unit_price', 'line_total'],
      status: 'inferred',
      explanation:
        'A bill line item belongs to one bill and one product, and stores the quantity, unit price, and line total observed on the bill.'
    }
  ];

  if (bill.items.length > 0) {
    dependencies.push({
      determinant: ['description'],
      dependent: ['product_id'],
      status: 'inferred',
      explanation:
        'Repeated line item descriptions in the current bill appear to map to a stable product, supporting reuse of the Products table.'
    });
  }

  return dependencies;
}

export function generateNormalization(bill: BillRecord): NormalizationResponse {
  try {
    return {
      source: bill.id,
      status: bill.status === 'confirmed' ? 'verified' : 'suggested',
      tables: buildTables(),
      relationships: buildRelationships(),
      dependencies: buildDependencies(bill)
    };
  } catch (error) {
    console.warn('[BahiVerse] Normalization generation failed; serving mock fallback.', error);
    return {
      ...MOCK_NORMALIZATION,
      source: bill.id,
      status: bill.status === 'confirmed' ? 'verified' : 'suggested'
    };
  }
}
