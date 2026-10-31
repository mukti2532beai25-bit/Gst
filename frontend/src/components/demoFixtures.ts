import type { BillExtractionResponse } from '../../../shared/types';

/**
 * Bundled fallback used when the demo backend is unreachable. Shape matches
 * MOCK_EXTRACTION from the backend so the review UI never renders empty.
 */
export const DEMO_BILL: BillExtractionResponse = {
  billId: 'demo-bill-001',
  status: 'needs_review',
  language: 'pa',
  fields: {
    billNumber: { value: 'B-102', confidence: 0.94, reviewStatus: 'pending' },
    billDate: { value: '2026-10-31', confidence: 0.88, reviewStatus: 'pending' },
    customerName: { value: 'Ravi Kumar', confidence: 0.82, reviewStatus: 'pending' },
    grandTotal: { value: 336, confidence: 0.71, reviewStatus: 'pending' }
  },
  items: [
    {
      description: 'Sugar (Chini)',
      quantity: 5,
      unit: 'kg',
      unitPrice: 42,
      lineTotal: 210,
      reviewStatus: 'pending'
    }
  ],
  warnings: ['Calculated line items total does not match bill grand total.']
};

export function cloneBill<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Inline handwritten-style kirana bill. Keeping it as markup means the demo
 * never depends on a binary file being present in the deployment.
 */
export const DEMO_BILL_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="520" viewBox="0 0 800 520" role="img" aria-label="Handwritten kirana bill B-102 for Ravi Kumar">
  <rect width="800" height="520" fill="#fdfbf3"/>
  <rect x="18" y="18" width="764" height="484" rx="10" fill="none" stroke="#d8cdb8" stroke-width="2" stroke-dasharray="7 6"/>
  <text x="400" y="70" text-anchor="middle" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="30" font-weight="700" fill="#2f2a24">Kirana Store - Bill #B-102</text>
  <text x="70" y="112" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="19" fill="#5b5145">Customer: Ravi Kumar</text>
  <text x="730" y="112" text-anchor="end" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="19" fill="#5b5145">Date: 31-10-2026</text>
  <line x1="60" y1="132" x2="740" y2="132" stroke="#8e8272" stroke-width="2"/>
  <text x="70" y="174" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="18" font-weight="700" fill="#3e362d">Item</text>
  <text x="430" y="174" text-anchor="middle" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="18" font-weight="700" fill="#3e362d">Qty</text>
  <text x="570" y="174" text-anchor="middle" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="18" font-weight="700" fill="#3e362d">Rate</text>
  <text x="730" y="174" text-anchor="end" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="18" font-weight="700" fill="#3e362d">Amount</text>
  <line x1="60" y1="192" x2="740" y2="192" stroke="#c9bda9" stroke-width="1.5"/>
  <text x="70" y="236" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="22" fill="#2f2a24">Chini (Sugar)</text>
  <text x="430" y="236" text-anchor="middle" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="21" fill="#2f2a24">5 kg</text>
  <text x="570" y="236" text-anchor="middle" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="21" fill="#2f2a24">₹42</text>
  <text x="730" y="236" text-anchor="end" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="21" fill="#2f2a24">₹210</text>
  <line x1="430" y1="248" x2="700" y2="248" stroke="#ddd3c1" stroke-width="1"/>
  <text x="600" y="300" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="19" fill="#5b5145">Subtotal</text>
  <text x="730" y="300" text-anchor="end" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="19" fill="#5b5145">₹210</text>
  <rect x="515" y="320" width="225" height="56" rx="6" fill="#fff3d6" stroke="#d9a441" stroke-width="2"/>
  <text x="535" y="355" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="21" font-weight="700" fill="#8a4b0f">Grand Total</text>
  <text x="720" y="355" text-anchor="end" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="24" font-weight="700" fill="#8a4b0f">₹336</text>
  <text x="70" y="350" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="17" fill="#9b3f2e">Note: Chini = Sugar, Peti = Box</text>
  <text x="70" y="380" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="17" fill="#9b3f2e">Grand total does not match item total.</text>
  <text x="400" y="462" text-anchor="middle" font-family="'Segoe Print','Comic Sans MS',cursive" font-size="16" fill="#8e8272">Demo asset • intentionally inconsistent for review</text>
</svg>`;

export const DEMO_BILL_SVG_DATA_URI = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
  DEMO_BILL_SVG
)}`;

export function sampleBillFile(): Blob {
  return new Blob([DEMO_BILL_SVG], { type: 'image/svg+xml' });
}
