import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface CampaignRow {
  id: string;
  clientId: string;
  name: string;
  objective: string;
  budget: string; // Prisma Decimal → string
  periodFrom: string;
  periodTo: string;
  status: 'planned' | 'active' | 'closed';
  metaCampaignId: string | null;
  client: { name: string; color: string };
}

export interface CampaignInput {
  clientId?: string;
  name: string;
  objective: string;
  budget: number;
  periodFrom: string;
  periodTo: string;
  status: 'planned' | 'active' | 'closed';
  metaCampaignId?: string;
}

export function useCampaigns(clientId?: string) {
  return useQuery({
    queryKey: ['campaigns', clientId ?? 'all'],
    queryFn: () => api.get<CampaignRow[]>(`/campaigns${clientId ? `?clientId=${clientId}` : ''}`),
    enabled: clientId !== '',
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CampaignInput) => api.post<CampaignRow>('/campaigns', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}

export function useUpdateCampaign(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<CampaignInput>) =>
      api.patch<CampaignRow>(`/campaigns/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['campaigns'] }),
  });
}
