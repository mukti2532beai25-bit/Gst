import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const PROBE_TIMEOUT_MS = 2_500;
const RETRY_COOLDOWN_MS = 15_000;

let prisma: PrismaClient | null = null;
let healthy: boolean | null = null;
let lastCheck = 0;

export type DatabaseStatus = 'connected' | 'fallback' | 'unconfigured';

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPrismaClient(): PrismaClient | null {
  if (!isDatabaseConfigured()) return null;
  if (!prisma) {
    prisma = new PrismaClient({ log: ['error'] });
  }
  return prisma;
}

export function databaseStatus(): DatabaseStatus {
  if (!isDatabaseConfigured()) return 'unconfigured';
  return healthy === true ? 'connected' : 'fallback';
}

export function markDatabaseHealthy(): void {
  healthy = true;
  lastCheck = Date.now();
}

export function markDatabaseFailure(): void {
  healthy = false;
  lastCheck = Date.now();
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch(() => {
        clearTimeout(timer);
        resolve(null);
      });
  });
}

export async function probeDatabase(): Promise<boolean> {
  const client = getPrismaClient();
  if (!client) {
    healthy = false;
    lastCheck = Date.now();
    return false;
  }

  const probe = client.$queryRaw`SELECT 1`;
  const result = await withTimeout(probe, PROBE_TIMEOUT_MS);
  if (result === null) {
    markDatabaseFailure();
    return false;
  }
  markDatabaseHealthy();
  return true;
}

export async function isDatabaseReady(): Promise<boolean> {
  if (!isDatabaseConfigured()) return false;
  if (healthy === true) return true;
  if (healthy === false && Date.now() - lastCheck < RETRY_COOLDOWN_MS) return false;
  return probeDatabase();
}

function isDatabaseUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = (error as { name?: string }).name ?? '';
  const code = (error as { code?: string }).code ?? '';
  const message = (error as { message?: string }).message ?? '';
  return (
    name.includes('PrismaClientInitializationError') ||
    ['P1000', 'P1001', 'P1002', 'P1003', 'P1008', 'P1010', 'P1017'].includes(code) ||
    /can't reach database server|connection refused|econnrefused|database server/i.test(message)
  );
}

export type DatabaseResult<T> = { ok: true; value: T } | { ok: false };

export async function runWithDatabase<T>(
  operation: (db: PrismaClient) => Promise<T>
): Promise<DatabaseResult<T>> {
  if (!(await isDatabaseReady())) return { ok: false };

  const db = getPrismaClient();
  if (!db) return { ok: false };

  try {
    const value = await operation(db);
    markDatabaseHealthy();
    return { ok: true, value };
  } catch (error) {
    if (isDatabaseUnavailableError(error)) {
      markDatabaseFailure();
      return { ok: false };
    }
    throw error;
  }
}
