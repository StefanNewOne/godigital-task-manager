import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface MetaAccount {
  pageId: string;
  pageName: string;
  igId: string | null;
  igUsername: string | null;
}

export interface MetaAdAccount {
  id: string;
  name: string;
}

interface BackfillResult {
  media: { created: number; updated: number; total: number };
  campaigns: { created: number; updated: number; total: number; snapshots: number };
  page: { captured: boolean; followers?: number | null };
}

export interface PageSnapshotRow {
  clientId: string;
  followers: number | null;
  engagement: number | null;
  pageViews: number | null;
  newFollows: number | null;
  videoViews: number | null;
  reactions: number | null;
  capturedAt: string;
  client: { name: string; color: string };
}

/** Најнови FB page snapshots по клиент (за Аналитика). */
export function usePageSnapshots(enabled: boolean) {
  return useQuery({
    queryKey: ['page-snapshots'],
    queryFn: () => api.get<PageSnapshotRow[]>('/meta/page-snapshots'),
    enabled,
  });
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

/** Достапни рекламни сметки (dir/am) за доделба metaAdAccountId. */
export function useMetaAdAccounts(enabled: boolean) {
  return useQuery({
    queryKey: ['meta-ad-accounts'],
    queryFn: () => api.get<MetaAdAccount[]>('/meta/ad-accounts'),
    enabled,
    staleTime: 5 * 60_000,
  });
}

/** Backfill постови (IG) + кампањи (платено) од сметките на клиентот + повлечи метрики. */
export function useBackfillClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId: string) =>
      api.post<BackfillResult>(`/meta/clients/${clientId}/backfill`, {}),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['analytics'] }),
  });
}
