import { BillExtractionResponse } from '../../../shared/types';
import { MOCK_EXTRACTION } from '../mockData';
import { clone, saveBill } from '../store';
import { applyVocabulary } from './vocabulary';

export type BillLanguage = 'en' | 'hi' | 'pa';

export interface OcrInput {
  image?: Buffer;
  mimeType?: string;
  language?: BillLanguage;
}

export interface OcrOutcome {
  bill: BillExtractionResponse;
  usedFallback: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isFieldItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const scalar = value.value;
  const validScalar =
    scalar === null || typeof scalar === 'string' || typeof scalar === 'number';
  return (
    validScalar &&
    typeof value.confidence === 'number' &&
    value.confidence >= 0 &&
    value.confidence <= 1 &&
    (value.reviewStatus === 'pending' ||
      value.reviewStatus === 'confirmed' ||
      value.reviewStatus === 'corrected')
  );
}

function isBillExtractionResponse(value: unknown): value is BillExtractionResponse {
  if (!isRecord(value)) return false;
  if (typeof value.billId !== 'string') return false;
  if (value.status !== 'needs_review' && value.status !== 'confirmed') return false;
  if (value.language !== 'en' && value.language !== 'hi' && value.language !== 'pa') {
    return false;
  }
  if (!isRecord(value.fields)) return false;

  const fields = value.fields;
  const requiredFields = ['billNumber', 'billDate', 'customerName', 'grandTotal'];
  if (!requiredFields.every((field) => isFieldItem(fields[field]))) {
    return false;
  }

  return Array.isArray(value.items) && Array.isArray(value.warnings);
}

async function callExternalOcr(
  input: OcrInput,
  billId: string
): Promise<unknown | null> {
  const endpoint = process.env.OCR_API_URL;
  if (!endpoint) return null;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(process.env.OCR_API_KEY
          ? { authorization: `Bearer ${process.env.OCR_API_KEY}` }
          : {})
      },
      body: JSON.stringify({
        billId,
        language: input.language,
        mimeType: input.mimeType,
        imageBase64: input.image?.toString('base64') ?? null
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`OCR provider responded with ${response.status}`);
    }

    return (await response.json()) as unknown;
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Runs OCR when configured, otherwise returns the canonical demo fixture.
 * Invalid or failed provider output always degrades to MOCK_EXTRACTION.
 */
export async function extractBill(
  input: OcrInput,
  billId: string
): Promise<OcrOutcome> {
  const warnings: string[] = [];

  if (process.env.OCR_API_URL) {
    try {
      const candidate = await callExternalOcr(input, billId);
      if (isBillExtractionResponse(candidate)) {
        const extracted = clone(candidate);
        extracted.billId = billId;
        extracted.language = input.language ?? extracted.language;

        const bill = saveBill(applyVocabulary(extracted));
        return { bill, usedFallback: false };
      }

      warnings.push('OCR provider returned an invalid payload; demo extraction used.');
    } catch (error) {
      const reason = error instanceof Error ? error.message : 'unknown OCR error';
      warnings.push(`OCR provider unavailable (${reason}); demo extraction used.`);
    }
  } else {
    warnings.push('OCR provider not configured; demo extraction used.');
  }

  const fallback = clone(MOCK_EXTRACTION);
  fallback.billId = billId;
  fallback.status = 'needs_review';
  fallback.language = input.language ?? fallback.language;
  fallback.warnings = [...fallback.warnings, ...warnings];

  const bill = saveBill(applyVocabulary(fallback));
  return { bill, usedFallback: true };
}
