// Помошници за компонентни тестови: рендер со providers (React Query + Router).
import type { ReactElement, ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { render, type RenderOptions, type RenderResult } from '@testing-library/react';

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
