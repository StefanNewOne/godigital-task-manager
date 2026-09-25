/** Тенок fetch client. Испраќа/чита JSON, носи cookies, фрла грешка со { code, message }. */
import { enqueueMutation } from './offlineQueue.js';

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);
function newKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export class ApiRequestError extends Error {
  constructor(
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

/**
 * Освежување на access токенот преку refresh cookie (httpOnly, scoped /api/auth).
 * Дедупликуван: паралелни 401-и делат еден refresh повик.
 */
let refreshPromise: Promise<boolean> | null = null;
function tryRefresh(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' })
      .then((r) => r.ok)
      .catch(() => false);
    void refreshPromise.finally(() => {
      refreshPromise = null;
    });
  }
  return refreshPromise;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true,
  idemKey?: string,
): Promise<T> {
  const mutating = MUTATING.has(method);
  const key = mutating ? (idemKey ?? newKey()) : undefined;
  const headers: Record<string, string> = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (key) headers['Idempotency-Key'] = key;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method,
      credentials: 'include',
      headers: Object.keys(headers).length ? headers : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (netErr) {
    // Мрежна грешка додека сме офлајн → зачувај ја мутацијата за подоцна (C3).
    if (mutating && typeof navigator !== 'undefined' && !navigator.onLine) {
      await enqueueMutation({ id: key!, method, path, body, at: Date.now() });
      throw new ApiRequestError(
        'OFFLINE_QUEUED',
        'Офлајн — промената е зачувана и ќе се синхронизира кога ќе се вратиш онлајн.',
      );
    }
    throw netErr;
  }
  // Истечен access токен → тивко освежи еднаш и повтори (без јамка на самите auth рути).
  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {
    if (await tryRefresh()) return request<T>(method, path, body, false, key);
  }
  const json = (await res.json().catch(() => null)) as { data?: T } & Partial<ApiError>;
  if (!res.ok) {
    throw new ApiRequestError(
      json?.code ?? 'UNKNOWN',
      json?.message ?? 'Настана грешка.',
      json?.details,
    );
  }
  return json?.data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
};
