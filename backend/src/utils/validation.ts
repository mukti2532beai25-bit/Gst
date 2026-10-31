import type { ReviewStatus } from '../../../shared/types';
import { HttpError } from './http';

export function asRecord(value: unknown, fieldName = 'body'): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, `${fieldName} must be a JSON object.`);
  }
  return value as Record<string, unknown>;
}

export function parseOptionalString(
  value: unknown,
  fieldName: string
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} must be a string.`);
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export function parseRequiredString(value: unknown, fieldName: string): string {
  const parsed = parseOptionalString(value, fieldName);
  if (parsed === undefined || parsed === null) {
    throw new HttpError(400, `${fieldName} is required.`);
  }
  return parsed;
}

export function parseOptionalNumber(
  value: unknown,
  fieldName: string
): number | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;

  const numeric = typeof value === 'number' ? value : Number(value);
  if (typeof value === 'boolean' || !Number.isFinite(numeric)) {
    throw new HttpError(400, `${fieldName} must be a valid number.`);
  }
  return numeric;
}

export function parseOptionalDate(
  value: unknown,
  fieldName: string
): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') {
    throw new HttpError(400, `${fieldName} must be an ISO date string.`);
  }
  const trimmed = value.trim();
  if (trimmed === '') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const date = new Date(`${trimmed}T00:00:00.000Z`);
    if (!Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === trimmed) {
      return trimmed;
    }
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${fieldName} must be a valid date.`);
  }
  return date.toISOString().slice(0, 10);
}

export function parseReviewStatus(
  value: unknown,
  fieldName: string
): ReviewStatus | undefined {
  if (value === undefined) return undefined;
  if (value === 'pending' || value === 'confirmed' || value === 'corrected') {
    return value;
  }
  throw new HttpError(400, `${fieldName} must be one of pending, confirmed, corrected.`);
}

export function parseOptionalBoolean(
  value: unknown,
  fieldName: string
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'boolean') return value;
  if (value === 'true' || value === 1 || value === '1') return true;
  if (value === 'false' || value === 0 || value === '0') return false;
  throw new HttpError(400, `${fieldName} must be a boolean.`);
}

export function parseFormat(value: unknown): 'csv' | 'json' {
  if (value === undefined || value === null || value === '') return 'json';
  if (value === 'csv' || value === 'json') return value;
  throw new HttpError(400, 'format must be either csv or json.');
}
