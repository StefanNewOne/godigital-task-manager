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
