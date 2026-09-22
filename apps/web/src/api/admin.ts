import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  ClientContactCreateInput,
  ClientContactUpdateInput,
  ClientCreateInput,
  ClientUpdateInput,
  EmployeeCreateInput,
  EmployeeUpdateInput,
} from '@gd/core';
import { api } from '../lib/api.js';
import type { ClientRow, ContactRow, EmployeeRow } from '../lib/types.js';

export function useEmployees() {
  return useQuery({ queryKey: ['employees'], queryFn: () => api.get<EmployeeRow[]>('/employees') });
}

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: () => api.get<ClientRow[]>('/clients') });
}

// ── Клиенти: создавање / уредување ──
export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientCreateInput) => api.post<ClientRow>('/clients', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

export function useUpdateClient(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientUpdateInput) => api.patch<ClientRow>(`/clients/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['clients'] }),
  });
}

// ── Вработени: создавање / уредување ──
export function useCreateEmployee() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeCreateInput) => api.post<EmployeeRow>('/employees', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

export function useUpdateEmployee(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: EmployeeUpdateInput) => api.patch<EmployeeRow>(`/employees/${id}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['employees'] }),
  });
}

// ── Контакти на клиент (вгнездено / топ-ниво update) ──
export function useClientContacts(clientId: string | null) {
  return useQuery({
    queryKey: ['client-contacts', clientId],
    queryFn: () => api.get<ContactRow[]>(`/clients/${clientId}/contacts`),
    enabled: !!clientId,
  });
}

export function useCreateContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientContactCreateInput) =>
      api.post<ContactRow>(`/clients/${clientId}/contacts`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-contacts', clientId] }),
  });
}

export function useUpdateContact(clientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ contactId, ...input }: ClientContactUpdateInput & { contactId: string }) =>
      api.patch<ContactRow>(`/contacts/${contactId}`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['client-contacts', clientId] }),
  });
}
