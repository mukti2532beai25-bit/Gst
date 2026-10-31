import type {
  BillExtractionResponse,
  NormalizationResponse
} from '@shared/types';
import { MOCK_EXTRACTION, MOCK_NORMALIZATION } from '@shared/mockData';

export interface ApiResult<T> {
  data: T;
  usedFallback: boolean;
  error?: string;
}

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/+$/, '');
const API_ROOT = RAW_BASE.endsWith('/api') ? RAW_BASE : `${RAW_BASE}/api`;
const REQUEST_TIMEOUT_MS = 4500;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function describeError(error: unknown): string {
  if (error instanceof DOMException && error.name === 'AbortError') {
    return 'Backend timed out';
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Backend unavailable';
}

function isExtraction(value: unknown): value is BillExtractionResponse {
  const candidate = value as Partial<BillExtractionResponse> | null;
  return Boolean(
    candidate &&
      typeof candidate.billId === 'string' &&
      candidate.fields &&
      typeof candidate.fields === 'object' &&
      Array.isArray(candidate.items) &&
      Array.isArray(candidate.warnings)
  );
}

function isNormalization(value: unknown): value is NormalizationResponse {
  const candidate = value as Partial<NormalizationResponse> | null;
  return Boolean(
    candidate &&
      typeof candidate.source === 'string' &&
      Array.isArray(candidate.tables) &&
      Array.isArray(candidate.relationships) &&
      Array.isArray(candidate.dependencies)
  );
}

async function request<T>(
  path: string,
  validate: (value: unknown) => value is T,
  init?: RequestInit
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${API_ROOT}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init?.headers ?? {})
      }
    });

    if (!response.ok) {
      throw new Error(`Backend responded with HTTP ${response.status}`);
    }

    const payload: unknown = await response.json();
    if (!validate(payload)) {
      throw new Error('Unexpected response shape');
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

export async function uploadBillImage(
  file: File
): Promise<ApiResult<BillExtractionResponse>> {
  const form = new FormData();
  form.append('file', file, file.name);

  try {
    const data = await request<BillExtractionResponse>(
      '/bills/upload',
      isExtraction,
      { method: 'POST', body: form }
    );
    return { data, usedFallback: false };
  } catch (error) {
    return {
      data: clone(MOCK_EXTRACTION),
      usedFallback: true,
      error: describeError(error)
    };
  }
}

export async function getBill(
  billId: string
): Promise<ApiResult<BillExtractionResponse>> {
  try {
    const data = await request<BillExtractionResponse>(
      `/bills/${encodeURIComponent(billId)}`,
      isExtraction
    );
    return { data, usedFallback: false };
  } catch (error) {
    return {
      data: { ...clone(MOCK_EXTRACTION), billId },
      usedFallback: true,
      error: describeError(error)
    };
  }
}

export async function getNormalization(
  billId: string
): Promise<ApiResult<NormalizationResponse>> {
  try {
    const data = await request<NormalizationResponse>(
      `/bills/${encodeURIComponent(billId)}/normalization`,
      isNormalization
    );
    return { data, usedFallback: false };
  } catch (error) {
    return {
      data: { ...clone(MOCK_NORMALIZATION), source: billId },
      usedFallback: true,
      error: describeError(error)
    };
  }
}
