import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface MetaAccount {
  pageId: string;
  pageName: string;
  igId: string | null;
  igUsername: string | null;
}

/** Достапни Meta страници + IG business сметки (dir/am) за доделба по клиент. */
export function useMetaAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ['meta-accounts'],
    queryFn: () => api.get<MetaAccount[]>('/meta/accounts'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Backfill постови од сметката на клиентот + повлечи метрики. */
export function useBackfillClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      api.post<{ backfill: { created: number; updated: number; total: number }; pulled: unknown }>(
        `/meta/clients/${clientId}/backfill`,
        {},
      ),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['analytics'] }),
  });
}
