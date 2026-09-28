import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface AnalyticsKpis {
  reach: number;
  impressions: number;
  views: number;
  engagement: number;
  spend: number;
  cpr: number | null;
  ctr: number | null;
  posts: number;
}

export interface AnalyticsSplit {
  organicReach: number;
  paidReach: number;
  organicPosts: number;
  paidPosts: number;
}

export interface AnalyticsCampaign {
  id: string;
  name: string;
  color: string;
  periodFrom: string;
  periodTo: string;
  spent: number;
  budget: number;
  reach: number;
  cpr: number | null;
}

export interface AnalyticsPost {
  publicationId: string;
  name: string;
  color: string;
  platform: string;
  paid: boolean;
  reach: number;
  engagement: number;
  rate: number | null;
}

export interface AnalyticsData {
  month: string;
  kpis: AnalyticsKpis;
  split: AnalyticsSplit;
  campaigns: AnalyticsCampaign[];
  topPosts: AnalyticsPost[];
  hasData: boolean;
}

export function useAnalytics(month: string) {
  return useQuery({
    queryKey: ['analytics', month],
    queryFn: () => api.get<AnalyticsData>(`/analytics?month=${month}`),
  });
}

// ── Редизајн: по клиент + период (Instagram · Facebook · Реклами) ──
export interface MonthMetric {
  month: string;
  reach: number;
  engagement: number;
  views: number;
  impressions: number;
  spend: number;
  posts: number;
}
export interface IgPost {
  id: string;
  permalink: string | null;
  mediaKind: 'video' | 'image';
  month: string | null;
  reach: number;
  engagement: number;
  views: number;
}
export interface AdNode {
  id: string;
  name: string;
  spend: number;
  reach: number;
  impressions: number;
  ctr: number | null;
  byMonth: MonthMetric[];
  children?: AdNode[];
}
export interface ClientAnalytics {
  clientId: string;
  clientName: string;
  from: string;
  to: string;
  instagram: {
    connected: boolean;
    totals: { reach: number; engagement: number; views: number; posts: number };
    byKind: Array<{
      kind: 'video' | 'image';
      posts: number;
      reach: number;
      engagement: number;
      views: number;
    }>;
    byMonth: MonthMetric[];
    topPosts: IgPost[];
  };
  facebook: {
    connected: boolean;
    note: string;
    byMonth: Array<{
      month: string;
      followers: number | null;
      engagement: number | null;
      pageViews: number | null;
      newFollows: number | null;
      videoViews: number | null;
      reactions: number | null;
    }>;
  };
  ads: {
    connected: boolean;
    totals: { spend: number; reach: number; impressions: number };
    byMonth: MonthMetric[];
    campaigns: AdNode[];
  };
}

export function useClientAnalytics(clientId: string, from: string, to: string) {
  return useQuery({
    queryKey: ['client-analytics', clientId, from, to],
    queryFn: () => api.get<ClientAnalytics>(`/analytics/client/${clientId}?from=${from}&to=${to}`),
    enabled: !!clientId,
  });
}
