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
  from: string;
  to: string;
  rows: ClientReportRow[];
}

export function useClientReport(from: string, to: string) {
  return useQuery({
    queryKey: ['report', 'clients', from, to],
    queryFn: () => api.get<ClientReport>(`/reports/clients?from=${from}&to=${to}`),
  });
}

/** URL за CSV преземање (cookie-auth оди со барањето). */
export function clientReportCsvUrl(from: string, to: string): string {
  return `/api/reports/clients.csv?from=${from}&to=${to}`;
}
