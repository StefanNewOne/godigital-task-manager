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

// ─────────────────────────── Модул 3 · Мета (read екрани) ───────────────────────────

export interface MetaOverview {
  alerts: { total: number; crit: number; high: number; mid: number; info: number };
  sync: { lastSyncAt: string | null; accounts: number; failing: number; readOnly: number };
  kpi: { activeCampaigns: number; todaySpend: number };
}
export interface MetaAlertRow {
  id: string;
  clientId: string;
  code: string;
  severity: 'crit' | 'high' | 'mid' | 'info';
  title: string;
  detail: string | null;
  objectMetaId: string | null;
  state: string;
  occurrences: number;
  lastSeenAt: string;
}
export interface MetaClientRow {
  id: string;
  name: string;
  color: string;
  target: string | null;
  campaigns: number;
  alerts: number;
  messages: number;
  todaySpend: number;
  monthSpend: number;
  currency: string | null;
  accessLevel: string | null;
  lastSyncAt: string | null;
}
export interface Kpi {
  spend: number;
  results: number;
  reach: number;
  cpr: number | null;
}
export interface CrossGroup {
  objectiveKey: string;
  objectiveLabel: string;
  aggregatable: boolean;
  spend: number;
  results: number;
  items: Array<{
    campaignMetaId: string;
    name: string;
    clientId: string;
    resultLabel: string;
    costLabel: string;
    spend: number;
    results: number;
    cpr: number | null;
    cprChangePct: number | null;
    goal: string | null;
  }>;
}
export interface CrossData {
  period: string;
  from: string;
  to: string;
  kpis: { spend: number; campaigns: number };
  groups: CrossGroup[];
}
export interface StructureAd {
  metaId: string;
  name: string;
  effectiveStatus: string | null;
  reviewStatus: string | null;
  publicationId: string | null;
  kpi: Kpi;
}
export interface StructureAdSet {
  metaId: string;
  name: string;
  effectiveStatus: string | null;
  learningStage: string | null;
  kpi: Kpi;
  ads: StructureAd[];
}
export interface StructureCampaign {
  metaId: string;
  name: string;
  objectiveLabel: string;
  resultLabel: string;
  effectiveStatus: string | null;
  dailyBudget: number | null;
  kpi: Kpi;
  adSets: StructureAdSet[];
}
export interface StructureData {
  clientId: string;
  period: string;
  campaigns: StructureCampaign[];
}

export function useMetaOverview() {
  return useQuery({
    queryKey: ['meta', 'overview'],
    queryFn: () => api.get<MetaOverview>('/meta/overview'),
  });
}
export function useMetaAlerts(clientId?: string) {
  const qs = clientId ? `?clientId=${clientId}` : '';
  return useQuery({
    queryKey: ['meta', 'alerts', clientId ?? ''],
    queryFn: () => api.get<MetaAlertRow[]>(`/meta/alerts${qs}`),
  });
}
export function usePatchAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; state: string; snoozedUntil?: string }) =>
      api.patch<MetaAlertRow>(`/meta/alerts/${input.id}`, {
        state: input.state,
        snoozedUntil: input.snoozedUntil,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['meta', 'alerts'] });
      void qc.invalidateQueries({ queryKey: ['meta', 'overview'] });
    },
  });
}
export function useMetaClients() {
  return useQuery({
    queryKey: ['meta', 'clients'],
    queryFn: () => api.get<MetaClientRow[]>('/meta/clients'),
  });
}
export function useMetaCross(period: string) {
  return useQuery({
    queryKey: ['meta', 'cross', period],
    queryFn: () => api.get<CrossData>(`/meta/cross?period=${period}`),
  });
}
export function useMetaStructure(clientId: string | null, period: string) {
  return useQuery({
    queryKey: ['meta', 'structure', clientId, period],
    queryFn: () => api.get<StructureData>(`/meta/clients/${clientId}/structure?period=${period}`),
    enabled: !!clientId,
  });
}

// ─────────────────────────── Модул 3 · Мета (Инбокс + Коментари) ───────────────────────────

export interface MetaConversationRow {
  id: string;
  clientId: string;
  channel: 'messenger' | 'instagram';
  participantName: string | null;
  sourceAdMetaId: string | null;
  lastMessageAt: string | null;
  unread: boolean;
  waitingSince: string | null;
  topic: string | null;
  tags: string[];
}
export interface MetaMessageRow {
  id: string;
  fromPage: boolean;
  text: string | null;
  sentAt: string | null;
  viaTemplate: string | null;
  bodyPurgedAt: string | null;
}
export interface MetaConversationDetail extends MetaConversationRow {
  messages: MetaMessageRow[];
}
export interface MetaCommentRow {
  id: string;
  clientId: string;
  parentObjectType: 'post' | 'ad';
  authorName: string | null;
  text: string | null;
  createdTime: string | null;
  isQuestion: boolean;
  isComplaint: boolean;
  tags: string[];
}

export function useMetaConversations(clientId?: string, unread?: boolean) {
  const params = new URLSearchParams();
  if (clientId) params.set('clientId', clientId);
  if (unread) params.set('unread', '1');
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['meta', 'conversations', clientId ?? '', unread ?? false],
    queryFn: () => api.get<MetaConversationRow[]>(`/meta/conversations${qs}`),
  });
}
export function useMetaConversation(id: string | null) {
  return useQuery({
    queryKey: ['meta', 'conversation', id],
    queryFn: () => api.get<MetaConversationDetail>(`/meta/conversations/${id}`),
    enabled: !!id,
  });
}
export function useSetConversationTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; tags: string[] }) =>
      api.patch<MetaConversationRow>(`/meta/conversations/${input.id}/tags`, { tags: input.tags }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meta', 'conversations'] }),
  });
}
export function useMetaComments(clientId?: string, filter?: string) {
  const params = new URLSearchParams();
  if (clientId) params.set('clientId', clientId);
  if (filter) params.set('filter', filter);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['meta', 'comments', clientId ?? '', filter ?? ''],
    queryFn: () => api.get<MetaCommentRow[]>(`/meta/comments${qs}`),
  });
}
export function useSetCommentTags() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; tags: string[] }) =>
      api.patch<MetaCommentRow>(`/meta/comments/${input.id}/tags`, { tags: input.tags }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meta', 'comments'] }),
  });
}

// ─────────────────────────── Модул 3 · Мета (Планови + Архива) ───────────────────────────

export type PlanStatus =
  'pending' | 'approved' | 'syncing' | 'done' | 'rejected' | 'mismatch' | 'withdrawn';

export interface MetaPlanRow {
  id: string;
  clientId: string;
  op: string;
  target: { campaignId?: string; adSetId?: string; adId?: string };
  params: Record<string, unknown> | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  consequences: string[];
  warnings: string[];
  status: PlanStatus;
  createdById: string;
  createdVia: 'manual' | 'assistant';
  note: string | null;
  rejectNote: string | null;
  createdAt: string;
}

export interface CreatePlanBody {
  op: string;
  clientId: string;
  target?: { campaignId?: string; adSetId?: string; adId?: string };
  params?: Record<string, unknown>;
  note?: string;
  via?: 'manual' | 'assistant';
  command?: string;
}

export function useMetaPlans(clientId?: string, status?: string) {
  const params = new URLSearchParams();
  if (clientId) params.set('clientId', clientId);
  if (status) params.set('status', status);
  const qs = params.toString() ? `?${params.toString()}` : '';
  return useQuery({
    queryKey: ['meta', 'plans', clientId ?? '', status ?? ''],
    queryFn: () => api.get<MetaPlanRow[]>(`/meta/plans${qs}`),
  });
}

export function useCreatePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: CreatePlanBody) => api.post<MetaPlanRow>('/meta/plans', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meta', 'plans'] }),
  });
}

export function usePlanAction() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      action: 'approve' | 'reject' | 'mark-done' | 'withdraw';
      note?: string;
    }) => api.post<MetaPlanRow>(`/meta/plans/${input.id}/${input.action}`, { note: input.note }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meta', 'plans'] }),
  });
}

export interface ArchiveRow {
  id: string;
  eventType: string;
  narrative: string;
  actorRole: string | null;
  clientId: string | null;
  objectType: string;
  objectId: string;
  occurredAt: string;
}

export function useMetaArchive(clientId?: string) {
  const qs = clientId ? `?clientId=${clientId}` : '';
  return useQuery({
    queryKey: ['meta', 'archive', clientId ?? ''],
    queryFn: () => api.get<ArchiveRow[]>(`/meta/archive${qs}`),
  });
}

// ─────────────────────────── Модул 3 · Мета (AI помошник §11) ───────────────────────────

export interface PlanDraft {
  op: string;
  clientId: string;
  target: { campaignId?: string; adSetId?: string; adId?: string };
  params: Record<string, unknown>;
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  consequences: string[];
  warnings: string[];
  command: string;
}

export interface MetaChatResult {
  answer: string;
  draft: PlanDraft | null;
  refused: boolean;
  toolsUsed: string[];
}

export function useMetaAssistant() {
  return useMutation({
    mutationFn: (input: { message: string; clientId?: string }) =>
      api.post<MetaChatResult>('/meta/assistant/chat', input),
  });
}

// ─────────────────────────── Модул 3 · Мета (Клиент детал — MF2) ───────────────────────────

export interface MetaClientProfile {
  id: string;
  name: string;
  color: string;
  accessLevel: string | null;
  currency: string | null;
  adAccountId: string | null;
  pageId: string | null;
  igId: string | null;
  profile: {
    targetText: string | null;
    targetValue: number | null;
    targetMetric: string | null;
    maxDailyBudget: number | null;
    freqThreshold: number;
    cprAlertPct: number;
    namingConvention: string | null;
    notes: string | null;
  };
}
export interface OrganicPost {
  id: string;
  taskId: string | null;
  mediaType: string | null;
  caption: string | null;
  thumbnailFileId: string | null;
  permalink: string | null;
  publishedAt: string | null;
  inAd: boolean;
  reach: number | null;
  views: number | null;
  engagement: number | null;
}
export interface OrganicData {
  clientId: string;
  period: string;
  connected: boolean;
  totals: { posts: number; reach: number; views: number; engagement: number };
  posts: OrganicPost[];
}
export interface ProfileUpdateBody {
  targetText?: string | null;
  maxDailyBudget?: number | null;
  freqThreshold?: number;
  cprAlertPct?: number;
  namingConvention?: string | null;
  notes?: string | null;
}

export function useMetaClientProfile(clientId: string | null) {
  return useQuery({
    queryKey: ['meta', 'client-profile', clientId],
    queryFn: () => api.get<MetaClientProfile>(`/meta/clients/${clientId}/profile`),
    enabled: !!clientId,
  });
}
export function useUpdateMetaProfile(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: ProfileUpdateBody) =>
      api.patch<unknown>(`/meta/clients/${clientId}/profile`, body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meta', 'client-profile', clientId] }),
  });
}
export function useMetaClientOrganic(clientId: string | null, period: string) {
  return useQuery({
    queryKey: ['meta', 'organic', clientId, period],
    queryFn: () => api.get<OrganicData>(`/meta/clients/${clientId}/organic?period=${period}`),
    enabled: !!clientId,
  });
}

// ─────────────────────────── Модул 3 · Мета (Поврзувања — MF3) ───────────────────────────

export interface MetaTokenCard {
  name: string;
  configured: boolean;
  valid: boolean;
  expiresAt: string | null;
  scopes: string[];
}
export interface MetaConnectionRow {
  clientId: string;
  name: string;
  color: string;
  adAccount: string | null;
  currency: string | null;
  accessLevel: string | null;
  page: string | null;
  ig: string | null;
  igMessages: boolean | null;
}
export interface MetaConnectionsData {
  tokens: MetaTokenCard[];
  rows: MetaConnectionRow[];
}

export function useMetaConnections() {
  return useQuery({
    queryKey: ['meta', 'connections'],
    queryFn: () => api.get<MetaConnectionsData>('/meta/connections'),
    staleTime: 5 * 60_000,
  });
}

/** „Освежи сега" — закажува sync во позадина + invalidate на сите meta прегледи. */
export function useMetaRefresh() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clientId?: string) =>
      api.post<{ scheduled: boolean; scope: string }>('/meta/refresh', { clientId }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['meta'] }),
  });
}
