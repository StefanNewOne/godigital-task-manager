import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { ReportModal } from './ReportModal.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('ReportModal', () => {
  it('прикажува ред по клиент + CSV копче', async () => {
    mockFetch({
      '/reports/clients': {
        month: '2026-09',
        rows: [
          {
            clientId: 'c1',
            name: 'Ресторан ИВ',
            videoPosts: 4,
            graphicPosts: 8,
            reach: 120000,
            impressions: 200000,
            engagement: 9000,
            spend: 450,
            cpr: 0.34,
          },
        ],
      },
    });
    renderWithProviders(<ReportModal month="2026-09" onClose={() => {}} />);

    expect(await screen.findByText('Ресторан ИВ')).toBeTruthy();
    expect(screen.getByText('Клиент')).toBeTruthy();
    const csv = screen.getByText('Преземи CSV') as HTMLAnchorElement;
    expect(csv.getAttribute('href')).toContain('/reports/clients.csv?month=2026-09');
  });
});
