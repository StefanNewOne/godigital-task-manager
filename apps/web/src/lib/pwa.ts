import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import { get, set, del } from 'idb-keyval';

/**
 * QueryClient за PWA: подолг `gcTime` за офлајн читање (C2) — кешот преживува рестарт
 * и се persist-ира во IndexedDB. Мутациите не се retry-ираат автоматски (офлајн ред е C3).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24h — за да има што да се persist-ира офлајн
      staleTime: 30_000,
      retry: 1,
    },
    mutations: { retry: false },
  },
});

const CACHE_KEY = 'gd-query-cache';

/** Async persister врз IndexedDB (idb-keyval). Само успешни queries се чуваат. */
export const idbPersister = createAsyncStoragePersister({
  key: CACHE_KEY,
  throttleTime: 1000,
  storage: {
    getItem: (k) => get(k),
    setItem: (k, v) => set(k, v),
    removeItem: (k) => del(k),
  },
});

/** Исчисти го персистираниот кеш (при одјава) — инаку reload го враќа стариот `me` (QA #2). */
export async function clearPersistedCache(): Promise<void> {
  await del(CACHE_KEY).catch(() => undefined);
}
