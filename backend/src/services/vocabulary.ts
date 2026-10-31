import { BillExtractionResponse } from '../../../shared/types';
import { clone } from '../store';

export interface VocabularyEntry {
  id: string;
  spokenOrWrittenTerm: string;
  canonicalValue: string;
  valueType: string;
  confirmedByUser: boolean;
}

export interface VocabularyInput {
  spokenOrWrittenTerm: string;
  canonicalValue: string;
  valueType: string;
}

const mappings: VocabularyEntry[] = [
  {
    id: 'vocab-chini',
    spokenOrWrittenTerm: 'chini',
    canonicalValue: 'Sugar',
    valueType: 'product',
    confirmedByUser: true
  },
  {
    id: 'vocab-peti',
    spokenOrWrittenTerm: 'peti',
    canonicalValue: 'Box',
    valueType: 'unit',
    confirmedByUser: true
  },
  {
    id: 'vocab-atta',
    spokenOrWrittenTerm: 'atta',
    canonicalValue: 'Wheat Flour',
    valueType: 'product',
    confirmedByUser: true
  }
];

let nextId = 1;

export function listVocabulary(): VocabularyEntry[] {
  return clone(mappings);
}

export function addVocabulary(input: VocabularyInput): VocabularyEntry {
  const term = input.spokenOrWrittenTerm.trim();
  const canonicalValue = input.canonicalValue.trim();
  const valueType = input.valueType.trim();

  if (!term || !canonicalValue || !valueType) {
    throw new Error('spokenOrWrittenTerm, canonicalValue and valueType are required');
  }

  const existing = mappings.find(
    (mapping) =>
      mapping.spokenOrWrittenTerm.toLowerCase() === term.toLowerCase() &&
      mapping.valueType.toLowerCase() === valueType.toLowerCase()
  );

  if (existing) {
    existing.canonicalValue = canonicalValue;
    existing.confirmedByUser = true;
    return clone(existing);
  }

  const entry: VocabularyEntry = {
    id: `vocab-custom-${nextId++}`,
    spokenOrWrittenTerm: term,
    canonicalValue,
    valueType,
    confirmedByUser: true
  };
  mappings.push(entry);
  return clone(entry);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Applies only user-confirmed mappings. It never overwrites an already
 * canonical description and never touches unconfirmed suggestions.
 */
export function applyVocabulary(
  bill: BillExtractionResponse,
  entries: VocabularyEntry[] = mappings
): BillExtractionResponse {
  const next = clone(bill);
  const confirmed = entries.filter((entry) => entry.confirmedByUser);

  const products = confirmed.filter(
    (entry) => entry.valueType.toLowerCase() === 'product'
  );
  const units = confirmed.filter(
    (entry) => entry.valueType.toLowerCase() === 'unit'
  );
  const customers = confirmed.filter(
    (entry) => entry.valueType.toLowerCase() === 'customer'
  );

  for (const item of next.items) {
    for (const product of products) {
      const termPattern = new RegExp(escapeRegExp(product.spokenOrWrittenTerm), 'gi');
      if (
        termPattern.test(item.description) &&
        !item.description.toLowerCase().includes(product.canonicalValue.toLowerCase())
      ) {
        item.description = item.description.replace(termPattern, product.canonicalValue);
        item.reviewStatus = 'corrected';
      }
    }

    if (item.unit) {
      const unit = units.find(
        (entry) => entry.spokenOrWrittenTerm.toLowerCase() === item.unit?.toLowerCase()
      );
      if (unit) {
        item.unit = unit.canonicalValue;
        item.reviewStatus = 'corrected';
      }
    }
  }

  const customerName = next.fields.customerName.value;
  if (typeof customerName === 'string') {
    for (const customer of customers) {
      if (customerName.toLowerCase() === customer.spokenOrWrittenTerm.toLowerCase()) {
        next.fields.customerName = {
          value: customer.canonicalValue,
          confidence: 1,
          reviewStatus: 'corrected'
        };
        break;
      }
    }
  }

  return next;
}
