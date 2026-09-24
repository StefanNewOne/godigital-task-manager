import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface AssistantSource {
  sourceType: string;
  sourceId: string;
  text: string;
}

export interface AssistantResponse {
  answer: string;
  grounded: boolean;
  sources: AssistantSource[];
}

/** Claude помошник (B4): прашај → одговор од знаењето со извори (само чита). */
export function useAssistant() {
  return useMutation({
    mutationFn: (input: { question: string; clientId?: string }) =>
      api.post<AssistantResponse>('/knowledge/assistant/ask', input),
  });
}
