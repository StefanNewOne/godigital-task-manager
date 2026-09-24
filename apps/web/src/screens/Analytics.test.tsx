import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { Analytics } from './Analytics.js';
import type { AnalyticsData } from '../api/analytics.js';

const DATA: AnalyticsData = {
  month: '2026-09',
  kpis: {
    reach: 586_000,
    impressions: 720_000,
    views: 405_000,
    engagement: 21_100,
    spend: 1_530,
    cpr: 0.34,
    ctr: 1.9,
    posts: 58,
  },
  split: { organicReach: 364_000, paidReach: 222_000, organicPosts: 36, paidPosts: 22 },
  campaigns: [
    {
      id: 'c1',
      name: 'Астибо · Есенска колекција',
      color: '#D97706',
      periodFrom: '2026-09-15T00:00:00.000Z',
      periodTo: '2026-09-30T00:00:00.000Z',
      spent: 286,
      budget: 450,
      reach: 84_200,
      cpr: 0.31,
    },
  ],
  topPosts: [
    {
      publicationId: 'p1',
      name: 'Алекс дизајн · Лежај Ена',
      color: '#DB2777',
      platform: 'ig',
      paid: true,
      reach: 61_700,
      engagement: 4_400,
      rate: 7.1,
    },
  ],
  hasData: true,
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Analytics', () => {
  it('прикажува KPI картички и распоред од /analytics', async () => {
    mockFetch({ '/analytics': DATA });
    renderWithProviders(<Analytics />);
    expect(await screen.findByText('Досег')).toBeTruthy();
    expect(screen.getByText('Органски наспроти платено')).toBeTruthy();
    expect(screen.getByText('Кампањи во тек')).toBeTruthy();
    expect(screen.getByText('Топ објави по ангажман')).toBeTruthy();
    expect(screen.getByText('Астибо · Есенска колекција')).toBeTruthy();
  });

  it('празна состојба кога нема метрики', async () => {
    mockFetch({
      '/analytics': { ...DATA, hasData: false, campaigns: [], topPosts: [] },
    });
    renderWithProviders(<Analytics />);
    expect(await screen.findByText(/Сè уште нема снимени метрики/)).toBeTruthy();
  });
});
