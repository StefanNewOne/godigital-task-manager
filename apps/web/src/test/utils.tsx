// Помошници за компонентни тестови: рендер со providers (React Query + Router).
import type { ReactElement, ReactNode } from 'react';
import { vi } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';

/**
 * Мокира глобален `fetch` по патека (без `/api` префикс, без query).
 * `{ '/overview': {...} }` → GET /api/overview враќа `{ data: {...} }`.
 * Непозната патека → 404 со { code, message }. Враќа mock за проверки.
 */
export function mockFetch(routes: Record<string, unknown>): ReturnType<typeof vi.fn> {
  const fn = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const path = url.replace(/^\/api/, '').split('?')[0] ?? '';
    if (Object.prototype.hasOwnProperty.call(routes, path)) {
      return { ok: true, json: async () => ({ data: routes[path] }) } as Response;
    }
    return {
      ok: false,
      json: async () => ({ code: 'NOT_FOUND', message: 'Нема.' }),
    } as Response;
  });
  vi.stubGlobal('fetch', fn);
  return fn;
}

/** Свеж QueryClient по тест: без retry, без кеш меѓу тестови. */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: 0 },
      mutations: { retry: false },
    },
  });
}

interface ProvidersProps {
  children: ReactNode;
  route?: string;
}

function Providers({ children, route = '/' }: ProvidersProps) {
  const client = makeQueryClient();
  return (
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[route]}>{children}</MemoryRouter>
    </QueryClientProvider>
  );
}

/** render() обвиткан со React Query + MemoryRouter. */
export function renderWithProviders(
  ui: ReactElement,
  opts?: { route?: string } & Omit<RenderOptions, 'wrapper'>,
): RenderResult {
  const { route, ...rest } = opts ?? {};
  return render(ui, {
    wrapper: ({ children }) => <Providers route={route}>{children}</Providers>,
    ...rest,
  });
}
