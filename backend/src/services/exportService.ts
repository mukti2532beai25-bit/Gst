import type { BillRecord } from '../types/domain';
import { lineItemsTotal, toExtractionResponse } from './billMapper';

export interface ExportResult {
  content: string;
  contentType: string;
  filename: string;
}

function safeFilenamePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9-_]+/g, '-').replace(/-+/g, '-').slice(0, 80);
}

function escapeCsv(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function buildCsv(bill: BillRecord): string {
  const extraction = toExtractionResponse(bill);
  const warnings = extraction.warnings.join(' | ');

  const headers = [
    'Bill ID',
    'Bill Number',
    'Bill Date',
    'Customer',
    'Status',
    'Item Description',
    'Quantity',
    'Unit',
    'Unit Price',
    'Line Total',
    'Subtotal',
    'Tax Total',
    'Grand Total',
    'Warnings'
  ];

  const base = [
    bill.id,
    extraction.fields.billNumber.value ?? '',
    extraction.fields.billDate.value ?? '',
    extraction.fields.customerName.value ?? '',
    extraction.status
  ];

  const totals = [
    extraction.fields.subtotal?.value ?? '',
    extraction.fields.taxTotal?.value ?? '',
    extraction.fields.grandTotal?.value ?? ''
  ];

  const rows: unknown[][] = [];
  if (bill.items.length === 0) {
    rows.push([...base, '', '', '', '', ...totals, warnings]);
  } else {
    bill.items.forEach((item, index) => {
      rows.push([
        ...base,
        item.description,
        item.quantity ?? '',
        item.unit ?? '',
        item.unitPrice ?? '',
        item.lineTotal ?? '',
        ...totals,
        index === 0 ? warnings : ''
      ]);
    });
  }

  return [headers, ...rows].map((row) => row.map(escapeCsv).join(',')).join('\r\n');
}

function buildJson(bill: BillRecord): string {
  const extraction = toExtractionResponse(bill);
  const draft = {
    documentType: 'bahiverse-accounting-draft',
    exportedAt: new Date().toISOString(),
    confirmed: bill.status === 'confirmed',
    billId: bill.id,
    billNumber: extraction.fields.billNumber.value,
    billDate: extraction.fields.billDate.value,
    customerName: extraction.fields.customerName.value,
    status: extraction.status,
    language: extraction.language,
    sourceImageUrl: bill.sourceImageUrl,
    lineItems: extraction.items,
    totals: {
      subtotal: extraction.fields.subtotal?.value ?? null,
      taxTotal: extraction.fields.taxTotal?.value ?? null,
      grandTotal: extraction.fields.grandTotal?.value ?? null,
      lineItemsTotal: lineItemsTotal(bill.items)
    },
    warnings: extraction.warnings,
    corrections: bill.corrections
  };

  return JSON.stringify(draft, null, 2);
}

export function buildExport(bill: BillRecord, format: 'csv' | 'json'): ExportResult {
  const filename = `bahiverse-bill-${safeFilenamePart(bill.id)}.${format}`;

  if (format === 'csv') {
    return {
      content: buildCsv(bill),
      contentType: 'text/csv; charset=utf-8',
      filename
    };
  }

  return {
    content: buildJson(bill),
    contentType: 'application/json; charset=utf-8',
    filename
  };
}
