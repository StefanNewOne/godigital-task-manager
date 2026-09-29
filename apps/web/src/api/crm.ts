import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ContentType, CrmSource, CrmStatus, LossReason } from '@gd/core';
import { api } from '../lib/api.js';

export interface LeadDocVersion {
  id: string;
  version: number;
  fileId: string | null;
  ret: string | null;
  clientRet: string | null;
}
export interface LeadPlanEntry {
  id: string;
  monthKey: string;
  day: number;
  contentType: ContentType;
}
export interface LeadEventRow {
  narrative: string;
  occurredAt: string;
  actorRole: string | null;
}
export interface LeadTeam {
  am?: string | null;
  rez?: string | null;
  krea?: string | null;
  ana?: string | null;
}

export interface LeadRow {
  id: string;
  name: string;
  status: CrmStatus;
  source: string;
  agentId: string;
  person: string;
  phone: string | null;
  email: string | null;
  pkgHint: string;
  pkgVideos: number;
  pkgGraphics: number;
  pkgMeta: boolean;
  pkgStart: string | null;
  pkgMonths: number;
  pkgCalType: 'standarden' | 'specificen';
  meetingDate: string | null;
  meetingTime: string | null;
  meetingPlace: string | null;
  meetingHeld: boolean;
  meetingNotes: string | null;
  meetingAudioFileId: string | null;
  analysisFileId: string | null;
  signedFileId: string | null;
  strategyFileId: string | null;
  fableFileId: string | null;
  lostFromStatus: CrmStatus | null;
  lossReason: string | null;
  lossNote: string | null;
  team: LeadTeam | null;
  activatedClientId: string | null;
  createdAt: string;
  updatedAt: string;
  stale: number;
  isStale: boolean;
  waitDir: boolean;
  offers?: LeadDocVersion[];
  contracts?: LeadDocVersion[];
  planEntries?: LeadPlanEntry[];
  events?: LeadEventRow[];
}

export interface CrmAgent {
  id: string;
  name: string;
  color: string;
}

export type CrmFilter = 'all' | 'waiting' | 'stale';

export function useLeads(filter: CrmFilter, agentId?: string) {
  const q = new URLSearchParams();
  if (filter !== 'all') q.set('filter', filter);
  if (agentId) q.set('agentId', agentId);
  const qs = q.toString();
  return useQuery({
    queryKey: ['crm', 'leads', filter, agentId ?? ''],
    queryFn: () => api.get<LeadRow[]>(`/crm/leads${qs ? `?${qs}` : ''}`),
  });
}

export function useLead(leadId: string | null) {
  return useQuery({
    queryKey: ['crm', 'lead', leadId],
    queryFn: () => api.get<LeadRow>(`/crm/leads/${leadId}`),
    enabled: !!leadId,
  });
}

export function useCrmAgents() {
  return useQuery({
    queryKey: ['crm', 'agents'],
    queryFn: () => api.get<CrmAgent[]>('/crm/agents'),
  });
}

function useLeadInvalidate() {
  const qc = useQueryClient();
  return (leadId?: string) => {
    void qc.invalidateQueries({ queryKey: ['crm', 'leads'] });
    if (leadId) void qc.invalidateQueries({ queryKey: ['crm', 'lead', leadId] });
  };
}

export interface TransitionArgs {
  to: CrmStatus;
  payload?: { comment?: string; lossReason?: LossReason; lossNote?: string };
}

export function useLeadTransition(leadId: string) {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: (args: TransitionArgs) =>
      api.post<LeadRow>(`/crm/leads/${leadId}/transition`, args),
    onSuccess: () => invalidate(leadId),
  });
}

export function useCreateLead() {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: (input: {
      name: string;
      source: CrmSource;
      person: string;
      phone?: string;
      email?: string;
      pkgHint?: string;
      agentId?: string;
    }) => api.post<LeadRow>('/crm/leads', input),
    onSuccess: () => invalidate(),
  });
}

export function useUploadDoc(leadId: string) {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: (input: { kind: string; fileId?: string }) =>
      api.post<LeadRow>(`/crm/leads/${leadId}/docs`, input),
    onSuccess: () => invalidate(leadId),
  });
}

export function useUpdateMeeting(leadId: string) {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: (input: {
      date?: string | null;
      time?: string;
      place?: string;
      held?: boolean;
      notes?: string;
    }) => api.put<LeadRow>(`/crm/leads/${leadId}/meeting`, input),
    onSuccess: () => invalidate(leadId),
  });
}

export function useMeetingNoShow(leadId: string) {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: () => api.post<LeadRow>(`/crm/leads/${leadId}/meeting/no-show`, {}),
    onSuccess: () => invalidate(leadId),
  });
}

export function useUpdatePackage(leadId: string) {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: (input: {
      videos: number;
      graphics: number;
      meta: boolean;
      start?: string;
      months: number;
      calType: 'standarden' | 'specificen';
    }) => api.put<LeadRow>(`/crm/leads/${leadId}/package`, input),
    onSuccess: () => invalidate(leadId),
  });
}

export function useSetContentPlan(leadId: string) {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: (entries: Array<{ monthKey: string; day: number; contentType: ContentType }>) =>
      api.put<LeadRow>(`/crm/leads/${leadId}/plan`, { entries }),
    onSuccess: () => invalidate(leadId),
  });
}

export function useUpdateTeam(leadId: string) {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: (input: LeadTeam) => api.put<LeadRow>(`/crm/leads/${leadId}/team`, input),
    onSuccess: () => invalidate(leadId),
  });
}

export function useReassignAgent(leadId: string) {
  const invalidate = useLeadInvalidate();
  return useMutation({
    mutationFn: (agentId: string) => api.put<LeadRow>(`/crm/leads/${leadId}/agent`, { agentId }),
    onSuccess: () => invalidate(leadId),
  });
}
