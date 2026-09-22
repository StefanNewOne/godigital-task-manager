import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { ClientRow, EmployeeRow } from '../lib/types.js';

export function useEmployees() {
  return useQuery({ queryKey: ['employees'], queryFn: () => api.get<EmployeeRow[]>('/employees') });
}

export function useClients() {
  return useQuery({ queryKey: ['clients'], queryFn: () => api.get<ClientRow[]>('/clients') });
}
