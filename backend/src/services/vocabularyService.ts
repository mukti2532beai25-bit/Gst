import * as repository from '../repositories/billRepository';
import type { VocabularyRecord } from '../types/domain';
import { HttpError } from '../utils/http';
import { asRecord, parseOptionalBoolean, parseRequiredString } from '../utils/validation';

async function requireBusiness(businessId: string) {
  const business = await repository.findBusiness(businessId);
  if (!business) throw new HttpError(404, 'Business not found.');
  return business;
}

export async function getVocabulary(businessId: string): Promise<VocabularyRecord[]> {
  await requireBusiness(businessId);
  return repository.listVocabulary(businessId);
}

export async function addVocabulary(
  businessId: string,
  rawBody: unknown
): Promise<VocabularyRecord> {
  await requireBusiness(businessId);
  const body = asRecord(rawBody);

  return repository.createVocabulary(businessId, {
    spokenOrWrittenTerm: parseRequiredString(
      body.spokenOrWrittenTerm,
      'spokenOrWrittenTerm'
    ),
    canonicalValue: parseRequiredString(body.canonicalValue, 'canonicalValue'),
    valueType: parseRequiredString(body.valueType, 'valueType'),
    confirmedByUser: parseOptionalBoolean(body.confirmedByUser, 'confirmedByUser')
  });
}
