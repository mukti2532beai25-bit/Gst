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
  tin: 3,
  teen: 3,
  three: 3,
  char: 4,
  chaar: 4,
  four: 4,
  panj: 5,
  punj: 5,
  paanch: 5,
  panch: 5,
  five: 5,
  chhe: 6,
  che: 6,
  six: 6,
  sat: 7,
  saat: 7,
  seven: 7,
  ath: 8,
  aath: 8,
  eight: 8,
  nau: 9,
  nine: 9,
  das: 10,
  ten: 10,
  // Gurmukhi
  ਇੱਕ: 1,
  ਦੋ: 2,
  ਤਿੰਨ: 3,
  ਚਾਰ: 4,
  ਪੰਜ: 5,
  ਛੇ: 6,
  ਸੱਤ: 7,
  ਅੱਠ: 8,
  ਨੌਂ: 9,
  ਦਸ: 10,
  // Devanagari
  एक: 1,
  दो: 2,
  तीन: 3,
  चार: 4,
  पांच: 5,
  पाँच: 5,
  छह: 6,
  सात: 7,
  आठ: 8,
  नौ: 9,
  दस: 10
};

const QUANTITY_UNIT_HINT =
  /(quantity|qty|matra|kilo|kilogram|kg|gram|litre|liter|ltr|peti|box|bori|dhabba|dabba|piece|pcs|मात्रा|किलो|ग्राम|लीटर|पेटी|बोरी|डिब्बा|डब्बा|ਕਵਾਂਟਿਟੀ|ਮਾਤਰਾ|ਕਿਲੋ|ਕਿੱਲੋ|ਗ੍ਰਾਮ|ਲੀਟਰ|ਪੇਟੀ|ਬੋਰੀ|ਡੱਬਾ)/iu;
const CORRECTION_VERB_HINT =
  /(kar\s*de|kardo|badal\s*de|rakh\s*de|कर\s*दे|करदो|बदल\s*दे|रख\s*दे|ਕਰ\s*ਦੇ|ਕਰਦੋ|ਬਦਲ\s*ਦੇ|ਰੱਖ\s*ਦੇ)/iu;
const PRICE_HINT =
  /(price|rate|daam|dam|mulya|rupee|rupaye|rupees|rs|कीमत|दाम|रेट|रुपये|ਕੀਮਤ|ਦਾਮ|ਰੇਟ|ਰੁਪਏ)/iu;
const UNIT_HINT =
  /(kilogram|kilo|kg|gram|litre|liter|ltr|peti|box|bori|sack|dhabba|dabba|tin|piece|pcs|dozen|darjan|किलो|ग्राम|लीटर|पेटी|बोरी|डिब्बा|डब्बा|ਕਿਲੋ|ਕਿੱਲੋ|ਗ੍ਰਾਮ|ਲੀਟਰ|ਪੇਟੀ|ਬੋਰੀ|ਡੱਬਾ)/iu;
const CUSTOMER_HINT =
  /(customer|grahak|gahak|naam|name|ग्राहक|नाम|ਗ੍ਰਾਹਕ|ਨਾਮ)/iu;
const READBACK_QUERY =
  /(?:\b(?:kul|total)\b[\s\S]{0,24}\b(?:kinne|kitne|dasso|dass|batao|bata|hoye)\b|\b(?:kinne|kitne)\s+(?:rupaye|rupees)\b|\b(?:total|kul)\s+(?:dasso|batao|bata)\b|ਕੁੱਲ|ਕਿੰਨੇ|ਰੁਪਏ|ਦੱਸੋ|कुल|कितने|रुपये|बताओ|दस्सो)/iu;

const KG_UNITS = new Set(['kilogram', 'kilo', 'kg', 'किलो', 'ਕਿਲੋ', 'ਕਿੱਲੋ']);
const GRAM_UNITS = new Set(['gram', 'g', 'ग्राम', 'ਗ੍ਰਾਮ']);
const LITRE_UNITS = new Set(['litre', 'liter', 'ltr', 'लीटर', 'ਲੀਟਰ']);
const BOX_UNITS = new Set(['peti', 'box', 'पेटी', 'ਪੇਟੀ']);
const SACK_UNITS = new Set(['bori', 'sack', 'बोरी', 'ਬੋਰੀ']);
const TIN_UNITS = new Set(['dhabba', 'dabba', 'tin', 'डिब्बा', 'डब्बा', 'ਡੱਬਾ']);

function findNumber(text: string): number | null {
  const digitMatch = text.match(/\d+(?:[.,]\d+)?/);
  if (digitMatch) {
    return Number(digitMatch[0].replace(',', '.'));
  }

  const tokens = text.toLowerCase().split(/[^\p{L}\p{N}\p{M}]+/u);
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
  if (KG_UNITS.has(unit)) return 'kg';
  if (GRAM_UNITS.has(unit)) return 'g';
  if (LITRE_UNITS.has(unit)) return 'l';
  if (BOX_UNITS.has(unit)) return 'Box';
  if (SACK_UNITS.has(unit)) return 'Sack';
  if (TIN_UNITS.has(unit)) return 'Tin';
  if (unit === 'piece' || unit === 'pcs') return 'pc';
  if (unit === 'dozen' || unit === 'darjan') return 'dozen';
  return unit;
}

function extractCustomerName(text: string): string | null {
  const nameMatch =
    /(?:naam|name|नाम|ਨਾਮ)\s*(?:da|ka|di|is|hai|का|की|के|ਦਾ|ਦੀ|ਦੇ|है|ਹੈ|:)?\s*([\p{L}][\p{L}\p{M}\s.'-]{0,40})/iu.exec(
      text
    );
  const customerMatch =
    /(?:customer|grahak|gahak|ग्राहक|ਗ੍ਰਾਹਕ)\s+(?:(?:da|ka|di|का|की|के|ਦਾ|ਦੀ|ਦੇ)\s+)?(?:(?:naam|name|नाम|ਨਾਮ)\s*)?([\p{L}][\p{L}\p{M}\s.'-]{0,40})/iu.exec(
      text
    );

  const raw = nameMatch?.[1] ?? customerMatch?.[1];
  if (!raw) return null;

  const cleaned = raw
    .split(
      /\s+(?:hai|is|ha|aa|da|ka|di|te|nu|है|हैं|का|की|के|ਦਾ|ਦੀ|ਦੇ|ਨੂੰ|ਤੇ)(?=\s|$)/iu
    )[0]
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
    const words = item.description
      .toLowerCase()
      .split(/[^\p{L}\p{N}\p{M}]+/u)
      .filter((word) => word.length > 2);
    return words.some((word) => lower.includes(word));
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
 * Deterministic multilingual correction parser. It covers Romanised and native
 * Gurmukhi/Devanagari shorthand without requiring an external LLM.
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

  // Read-back phrases may share an utterance with a correction; a pure query
  // simply falls through without any mutations below.
  const isReadBackQuery = READBACK_QUERY.test(text);

  const itemIndex = selectItemIndex(next, text, targetItemId);
  const item = next.items[itemIndex];
  const hasExplicitPriceIntent =
    /(price|rate|daam|mulya|कीमत|दाम|रेट|ਕੀਮਤ|ਦਾਮ|ਰੇਟ)/iu.test(text);
  const hasPriceIntent =
    hasExplicitPriceIntent || (!isReadBackQuery && PRICE_HINT.test(text));
  const hasQuantityUnitIntent = QUANTITY_UNIT_HINT.test(text);
  const hasQuantityIntent =
    hasQuantityUnitIntent ||
    (!hasPriceIntent && CORRECTION_VERB_HINT.test(text));

  if (hasQuantityIntent) {
    const quantity = findNumberNear(
      text,
      hasQuantityUnitIntent ? QUANTITY_UNIT_HINT : CORRECTION_VERB_HINT
    );

    if (quantity !== null && item) {
      corrections.push({
        field: `items[${itemIndex}].quantity`,
        itemId: item.id,
        originalValue: originalValue(item.quantity),
        correctedValue: String(quantity)
      });

      item.quantity = quantity;

      const unit = extractUnit(text);
      if (unit) {
        if (unit !== item.unit) {
          corrections.push({
            field: `items[${itemIndex}].unit`,
            itemId: item.id,
            originalValue: originalValue(item.unit),
            correctedValue: unit
          });
        }
        item.unit = unit;
      }

      item.reviewStatus = 'corrected';

      if (item.unitPrice !== null) {
        item.lineTotal = Number((quantity * item.unitPrice).toFixed(2));
      }
    }
  }

  if (hasPriceIntent) {
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

  if (CUSTOMER_HINT.test(text)) {
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

  if (corrections.length === 0 && !isReadBackQuery) {
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
