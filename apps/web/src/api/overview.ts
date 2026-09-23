import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface CoverageRow {
  clientId: string;
  name: string;
  color: string;
  video: number | null;
  graphic: number | null;
  videoQuota: number;
  graphicQuota: number;
  videoUntil: string | null;
  graphicUntil: string | null;
  days: number;
  level: 'ok' | 'warn' | 'danger';
}

export interface OverviewData {
  coverage: CoverageRow[];
  byStatus: Array<{ status: string; count: number; avgDays: number }>;
  alarms: unknown[];
  campaigns: unknown[];
}

export function useOverview(month?: string) {
  return useQuery({
    queryKey: ['overview', month ?? 'all'],
    queryFn: () =>
      api.get<OverviewData>(month ? `/overview?month=${encodeURIComponent(month)}` : '/overview'),
  });
}
