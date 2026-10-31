import { BillExtractionResponse, NormalizationResponse } from './types';

export const MOCK_EXTRACTION: BillExtractionResponse = {
  billId: "demo-bill-001",
  status: "needs_review",
  language: "pa",
  fields: {
    billNumber: { value: "B-102", confidence: 0.94, reviewStatus: "pending" },
    billDate: { value: "2026-10-31", confidence: 0.88, reviewStatus: "pending" },
    customerName: { value: "Ravi Kumar", confidence: 0.82, reviewStatus: "pending" },
    grandTotal: { value: 336, confidence: 0.71, reviewStatus: "pending" }
  },
  items: [
    {
      description: "Sugar (Chini)",
      quantity: 5,
      unit: "kg",
      unitPrice: 42,
      lineTotal: 210,
      reviewStatus: "pending"
    }
  ],
  warnings: ["Calculated line items total does not match bill grand total."]
};

export const MOCK_NORMALIZATION: NormalizationResponse = {
  source: "demo-bill-001",
  status: "suggested",
  tables: [
    {
      name: "Customers",
      fields: [
        { name: "customer_id", type: "id", primaryKey: true },
        { name: "customer_name", type: "string" }
      ]
    },
    {
      name: "Bills",
      fields: [
        { name: "bill_id", type: "id", primaryKey: true },
        { name: "customer_id", type: "id", foreignKey: "Customers.customer_id" },
        { name: "grand_total", type: "decimal" }
      ]
    },
    {
      name: "BillItems",
      fields: [
        { name: "bill_item_id", type: "id", primaryKey: true },
        { name: "bill_id", type: "id", foreignKey: "Bills.bill_id" },
        { name: "product_id", type: "id", foreignKey: "Products.product_id" },
        { name: "quantity", type: "decimal" },
        { name: "line_total", type: "decimal" }
      ]
    },
    {
      name: "Products",
      fields: [
        { name: "product_id", type: "id", primaryKey: true },
        { name: "product_name", type: "string" },
        { name: "default_unit", type: "string" }
      ]
    }
  ],
  relationships: [
    { from: "Bills.customer_id", to: "Customers.customer_id", label: "many-to-one" },
    { from: "BillItems.bill_id", to: "Bills.bill_id", label: "many-to-one" },
    { from: "BillItems.product_id", to: "Products.product_id", label: "many-to-one" }
  ],
  dependencies: [
    {
      determinant: ["customer_id"],
      dependent: ["customer_name"],
      status: "inferred",
      explanation: "Within the observed bills, customer_id deterministically maps to one customer_name."
    }
  ]
};
