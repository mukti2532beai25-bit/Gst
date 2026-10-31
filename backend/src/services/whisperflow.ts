import { BillExtractionResponse } from '../../../shared/types';
import { clone, saveBill } from '../store';
import type { BillLanguage } from './ocr';

export interface VoiceCorrection {
  field: string;
  itemId?: string;
  originalValue: string | null;
  correctedValue: string;
}

export interface VoiceCorrectionResult {
  bill: BillExtractionResponse;
  corrections: VoiceCorrection[];
  readBack: string;
  warnings: string[];
}

const NUMBER_WORDS: Record<string, number> = {
  ek: 1,
  ik: 1,
  one: 1,
  do: 2,
  two: 2,
  teen: 3,
  tin: 3,
  three: 3,
  char: 4,
  chaar: 4,
  four: 4,
  paanch: 5,
  panch: 5,
  five: 5,
  chhe: 6,
  che: 6,
  six: 6,
  saat: 7,
  sat: 7,
  seven: 7,
  aath: 8,
  ath: 8,
  eight: 8,
  nau: 9,
  nine: 9,
  das: 10,
  ten: 10
};

const QUANTITY_HINT = /(quantity|qty|matra|kilo|kilogram|kg|gram|litre|liter|ltr|peti|box|piece|pcs)/iu;
const PRICE_HINT = /(price|rate|daam|dam|mulya|rupee|rupaye|rupees|rs)/iu;
const UNIT_HINT =
  /(kilo|kilogram|kg|gram|litre|liter|ltr|peti|box|piece|pcs|dozen|darjan)/iu;

function findNumber(text: string): number | null {
  const digitMatch = text.match(/\d+(?:[.,]\d+)?/);
  if (digitMatch) {
    return Number(digitMatch[0].replace(',', '.'));
  }

  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}]+/u);
  for (const token of tokens) {
    if (token in NUMBER_WORDS) {
      return NUMBER_WORDS[token];
    }
  }

  return null;
}

function findNumberNear(text: string, hint: RegExp): number | null {
  const match = hint.exec(text);
  if (match) {
    const near = findNumber(text.slice(match.index));
    if (near !== null) return near;
  }
  return findNumber(text);
}

function extractUnit(text: string): string | null {
  const match = UNIT_HINT.exec(text);
  if (!match) return null;

  const unit = match[0].toLowerCase();
  if (unit === 'kilo' || unit === 'kilogram' || unit === 'kg') return 'kg';
  if (unit === 'gram') return 'g';
  if (unit === 'litre' || unit === 'liter' || unit === 'ltr') return 'l';
  if (unit === 'peti' || unit === 'box') return 'box';
  if (unit === 'piece' || unit === 'pcs') return 'pc';
  if (unit === 'dozen' || unit === 'darjan') return 'dozen';
  return unit;
}

function extractCustomerName(text: string): string | null {
  const nameMatch =
    /(?:naam|name)\s*(?:da|ka|di|is|hai|:)?\s*([\p{L}][\p{L}\s.'-]{0,40})/iu.exec(text);
  const customerMatch = /(?:customer|grahak)\s+(?:da\s+naam\s+)?([\p{L}][\p{L}\s.'-]{0,40})/iu.exec(
    text
  );

  const raw = nameMatch?.[1] ?? customerMatch?.[1];
  if (!raw) return null;

  const cleaned = raw
    .split(/\s+(?:hai|is|ha|aa|da|ka|di|te|nu)\b/iu)[0]
    .replace(/[.,!?;:]+$/u, '')
    .trim();

  return cleaned.length >= 2 ? cleaned : null;
}

function selectItemIndex(
  bill: BillExtractionResponse,
  transcript: string,
  targetItemId?: string
): number {
  if (targetItemId) {
    const index = bill.items.findIndex((item) => item.id === targetItemId);
    if (index >= 0) return index;
  }

  const lower = transcript.toLowerCase();
  const index = bill.items.findIndex((item) => {
    const firstWord = item.description.split(/\s+/)[0]?.toLowerCase();
    return firstWord !== undefined && lower.includes(firstWord);
  });

  return index >= 0 ? index : 0;
}

export function buildReadBack(
  bill: BillExtractionResponse,
  language: BillLanguage = bill.language
): string {
  const billNumber = bill.fields.billNumber.value ?? '—';
  const customer = bill.fields.customerName.value ?? '—';
  const total = bill.fields.grandTotal.value ?? '—';
  const itemCount = bill.items.length;

  if (language === 'hi') {
    return `बिल ${billNumber}, ग्राहक ${customer}, कुल ${total} रुपये, ${itemCount} आइटम।`;
  }

  if (language === 'pa') {
    return `ਬਿੱਲ ${billNumber}, ਗਾਹਕ ${customer}, ਕੁੱਲ ${total} ਰੁਪਏ, ${itemCount} ਆਈਟਮ।`;
  }

  return `Bill ${billNumber}, customer ${customer}, total ${total} rupees, ${itemCount} items.`;
}

function originalValue(value: string | number | null): string | null {
  return value === null ? null : String(value);
}

/**
 * Deterministic correction parser for demo transcripts. No external LLM is
 * required; failures simply return the unchanged bill plus a warning.
 */
export function applyVoiceCorrection(
  transcript: string,
  bill: BillExtractionResponse,
  targetItemId?: string
): VoiceCorrectionResult {
  const next = clone(bill);
  const corrections: VoiceCorrection[] = [];
  const warnings: string[] = [];
  const text = transcript.trim();

  if (text.length < 2) {
    warnings.push('Transcript was empty; no correction applied.');
    return {
      bill: saveBill(next),
      corrections,
      readBack: buildReadBack(next),
      warnings
    };
  }

  const itemIndex = selectItemIndex(next, text, targetItemId);
  const item = next.items[itemIndex];

  if (QUANTITY_HINT.test(text)) {
    const quantity = findNumberNear(text, QUANTITY_HINT);
    if (quantity !== null && item) {
      corrections.push({
        field: `items[${itemIndex}].quantity`,
        itemId: item.id,
        originalValue: originalValue(item.quantity),
        correctedValue: String(quantity)
      });

      item.quantity = quantity;
      const unit = extractUnit(text);
      if (unit) item.unit = unit;
      item.reviewStatus = 'corrected';

      if (item.unitPrice !== null) {
        item.lineTotal = Number((quantity * item.unitPrice).toFixed(2));
      }
    }
  }

  if (PRICE_HINT.test(text)) {
    const price = findNumberNear(text, PRICE_HINT);
    if (price !== null && item) {
      corrections.push({
        field: `items[${itemIndex}].unitPrice`,
        itemId: item.id,
        originalValue: originalValue(item.unitPrice),
        correctedValue: String(price)
      });

      item.unitPrice = price;
      item.reviewStatus = 'corrected';

      if (item.quantity !== null) {
        item.lineTotal = Number((item.quantity * price).toFixed(2));
      }
    }
  }

  if (/(customer|grahak|naam|name)/iu.test(text)) {
    const customerName = extractCustomerName(text);
    if (customerName) {
      corrections.push({
        field: 'fields.customerName',
        originalValue: originalValue(next.fields.customerName.value),
        correctedValue: customerName
      });

      next.fields.customerName = {
        value: customerName,
        confidence: 1,
        reviewStatus: 'corrected'
      };
    }
  }

  if (corrections.length === 0) {
    warnings.push('No supported correction found in the transcript; bill left unchanged.');
  }

  const saved = saveBill(next);
  return {
    bill: saved,
    corrections,
    readBack: buildReadBack(saved),
    warnings
  };
}
