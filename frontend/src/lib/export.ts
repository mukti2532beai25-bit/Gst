import type { BillExtractionResponse } from '@shared/types';

const csvCell = (value: unknown): string => {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
};

const safeId = (billId: string): string =>
  billId.replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '') || 'bill';

export function buildBillJson(bill: BillExtractionResponse): string {
  return JSON.stringify(
    {
      generator: 'BahiVerse AI',
      disclaimer: 'Draft - Review Required',
      exportedAt: new Date().toISOString(),
      bill
    },
    null,
    2
  );
}

export function buildBillCsv(bill: BillExtractionResponse): string {
  const rows: string[][] = [
    ['BahiVerse AI Export', 'Draft - Review Required'],
    ['Bill ID', bill.billId],
    ['Status', bill.status],
    ['Language', bill.language],
    ['Exported At', new Date().toISOString()],
    [],
    ['Field', 'Value', 'Confidence', 'Review Status'],
    ['Bill Number', String(bill.fields.billNumber.value ?? ''), bill.fields.billNumber.confidence.toFixed(2), bill.fields.billNumber.reviewStatus],
    ['Bill Date', String(bill.fields.billDate.value ?? ''), bill.fields.billDate.confidence.toFixed(2), bill.fields.billDate.reviewStatus],
    ['Customer Name', String(bill.fields.customerName.value ?? ''), bill.fields.customerName.confidence.toFixed(2), bill.fields.customerName.reviewStatus],
    ['Grand Total', String(bill.fields.grandTotal.value ?? ''), bill.fields.grandTotal.confidence.toFixed(2), bill.fields.grandTotal.reviewStatus],
    [],
    ['#', 'Description', 'Quantity', 'Unit', 'Unit Price', 'Line Total', 'Review Status'],
    ...bill.items.map((item, index) => [
      String(index + 1),
      item.description,
      String(item.quantity ?? ''),
      item.unit ?? '',
      String(item.unitPrice ?? ''),
      String(item.lineTotal ?? ''),
      item.reviewStatus
    ]),
    [],
    ['Warnings', ...(bill.warnings.length ? bill.warnings : ['None'])]
  ];

  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
}

function download(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadBillJson(bill: BillExtractionResponse): void {
  download(`bahiverse-${safeId(bill.billId)}-draft.json`, buildBillJson(bill), 'application/json');
}

export function downloadBillCsv(bill: BillExtractionResponse): void {
  download(`bahiverse-${safeId(bill.billId)}-draft.csv`, buildBillCsv(bill), 'text/csv');
}
