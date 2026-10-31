import type { BillExtractionResponse } from '../../../shared/types';
import { cloneBill } from './demoFixtures';

export type VocabularyValueType = 'product' | 'unit' | 'customer';

export interface VocabularySuggestion {
  spokenOrWrittenTerm: string;
  canonicalValue: string;
  valueType: VocabularyValueType;
}

export interface VocabularyEntry extends VocabularySuggestion {
  id: string;
  confirmedByUser: boolean;
}

const VERNACULAR_TERMS: readonly VocabularySuggestion[] = [
  { spokenOrWrittenTerm: 'chini', canonicalValue: 'Sugar', valueType: 'product' },
  { spokenOrWrittenTerm: 'peti', canonicalValue: 'Box', valueType: 'unit' },
  { spokenOrWrittenTerm: 'atta', canonicalValue: 'Wheat Flour', valueType: 'product' },
  { spokenOrWrittenTerm: 'bori', canonicalValue: 'Sack', valueType: 'unit' }
];

function containsTerm(text: string | null | undefined, term: string): boolean {
  if (!text) return false;
  return text.toLowerCase().includes(term.toLowerCase());
}

function itemHasTerm(
  item: BillExtractionResponse['items'][number],
  mapping: VocabularySuggestion
): boolean {
  if (mapping.valueType === 'unit') {
    return containsTerm(item.unit, mapping.spokenOrWrittenTerm);
  }
  return containsTerm(item.description, mapping.spokenOrWrittenTerm);
}

function afterHasCanonical(
  after: BillExtractionResponse,
  mapping: VocabularySuggestion
): boolean {
  return after.items.some((item) => {
    if (mapping.valueType === 'unit') {
      return (
        (item.unit ?? '').toLowerCase() === mapping.canonicalValue.toLowerCase()
      );
    }
    return containsTerm(item.description, mapping.canonicalValue);
  });
}

/**
 * Finds vernacular terms that were actually changed into their canonical
 * English values between two bill snapshots (or came from a spoken command).
 */
export function detectVocabularySuggestions(
  transcript: string,
  before: BillExtractionResponse | null,
  after: BillExtractionResponse
): VocabularySuggestion[] {
  const suggestions: VocabularySuggestion[] = [];

  for (const mapping of VERNACULAR_TERMS) {
    if (!afterHasCanonical(after, mapping)) continue;

    const spokenTerm = containsTerm(transcript, mapping.spokenOrWrittenTerm);
    const previousTerm =
      before?.items.some((item) => itemHasTerm(item, mapping)) ?? false;

    if (!spokenTerm && !previousTerm) continue;

    const changed = before
      ? after.items.some((item, index) => {
          const previous = before.items[index];
          if (!previous) return false;
          if (mapping.valueType === 'unit') {
            return (previous.unit ?? '') !== (item.unit ?? '');
          }
          return previous.description !== item.description;
        })
      : true;

    if (changed) {
      suggestions.push({ ...mapping });
    }
  }

  return suggestions;
}

export function mergeVocabularySuggestions(
  existing: VocabularySuggestion[],
  incoming: VocabularySuggestion[]
): VocabularySuggestion[] {
  const merged = new Map<string, VocabularySuggestion>();

  for (const suggestion of [...existing, ...incoming]) {
    merged.set(
      `${suggestion.spokenOrWrittenTerm}:${suggestion.valueType}`,
      suggestion
    );
  }

  return [...merged.values()];
}

/**
 * Client-side canonicalisation used by the offline demo preset. This keeps
 * shorthand like "Atta 2 Peti" readable even without the API.
 */
export function applyVernacularTerms(
  bill: BillExtractionResponse,
  transcript: string
): BillExtractionResponse {
  const next = cloneBill(bill);
  const item = next.items[0];
  if (!item) return next;

  for (const mapping of VERNACULAR_TERMS) {
    if (!containsTerm(transcript, mapping.spokenOrWrittenTerm)) continue;

    if (mapping.valueType === 'unit') {
      item.unit = mapping.canonicalValue;
    } else if (mapping.valueType === 'product') {
      item.description = mapping.canonicalValue;
    }

    item.reviewStatus = 'corrected';
  }

  return next;
}
