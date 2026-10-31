type ApiEnv = ImportMeta & {
  env?: Record<string, string | undefined>;
};

export const API_BASE_URL =
  (import.meta as ApiEnv).env?.VITE_API_BASE_URL || 'http://localhost:5000';

export async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}).`);
  }

  return (await response.json()) as T;
}
