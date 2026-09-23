/** Тенок fetch client. Испраќа/чита JSON, носи cookies, фрла грешка со { code, message }. */

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
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

async function request<T>(method: string, path: string, body?: unknown, retry = true): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  // Истечен access токен → тивко освежи еднаш и повтори (без јамка на самите auth рути).
  if (res.status === 401 && retry && path !== '/auth/refresh' && path !== '/auth/login') {
    if (await tryRefresh()) return request<T>(method, path, body, false);
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
