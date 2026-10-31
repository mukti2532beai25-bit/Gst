import { NormalizationResponse } from '../../../shared/types';
import { MOCK_NORMALIZATION } from '../mockData';
import { clone } from '../store';

/**
 * Normalisation is derived from the fixed relational model. The demo response
 * mirrors the Prisma schema; any future provider must degrade to this fixture.
 */
export function getNormalization(billId: string): NormalizationResponse {
  const response = clone(MOCK_NORMALIZATION);
  response.source = billId;
  return response;
}
