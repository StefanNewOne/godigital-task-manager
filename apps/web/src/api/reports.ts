import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface ClientReportRow {
  clientId: string;
  name: string;
  videoPosts: number;
  graphicPosts: number;
  reach: number;
  impressions: number;
  engagement: number;
  spend: number;
  cpr: number | null;
}

export interface ClientReport {
  month: string;
  rows: ClientReportRow[];
}

export function useClientReport(month: string) {
  return useQuery({
    queryKey: ['report', 'clients', month],
    queryFn: () => api.get<ClientReport>(`/reports/clients?month=${month}`),
  });
}

/** URL за CSV преземање (cookie-auth оди со барањето). */
export function clientReportCsvUrl(month: string): string {
  return `/api/reports/clients.csv?month=${month}`;
}
