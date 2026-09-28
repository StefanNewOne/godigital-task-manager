import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { Analytics } from './Analytics.js';
import type { ClientAnalytics } from '../api/analytics.js';

const CLIENTS = [{ id: 'cl1', name: 'Алекс Дизајн', color: '#DB2777', status: 'aktiven' }];

const DATA: ClientAnalytics = {
  clientId: 'cl1',
  clientName: 'Алекс Дизајн',
  from: '2026-09',
  to: '2026-09',
  instagram: {
    connected: true,
    totals: { reach: 61_700, engagement: 4_400, views: 12_000, posts: 8 },
    byKind: [
      { kind: 'video', posts: 3, reach: 40_000, engagement: 3_000, views: 12_000 },
      { kind: 'image', posts: 5, reach: 21_700, engagement: 1_400, views: 0 },
    ],
    byMonth: [
      {
        month: '2026-09',
        reach: 61_700,
        engagement: 4_400,
        views: 12_000,
        impressions: 0,
        spend: 0,
        posts: 8,
      },
    ],
    topPosts: [],
  },
  facebook: {
    connected: true,
    note: 'Досегот по страница е укинат од Meta.',
    byMonth: [
      {
        month: '2026-09',
        followers: 23_441,
        engagement: 17_183,
        pageViews: 10_473,
        newFollows: 262,
        videoViews: 443_423,
        reactions: 2_198,
      },
    ],
  },
  ads: {
    connected: true,
    totals: { spend: 1_655, reach: 193_569, impressions: 1_756_519 },
    byMonth: [
      {
        month: '2026-09',
        reach: 193_569,
        engagement: 0,
        views: 0,
        impressions: 1_756_519,
        spend: 1_655,
        posts: 0,
      },
    ],
    campaigns: [
      {
        id: 'camp1',
        name: 'Промо недела',
        spend: 1_655,
        reach: 193_569,
        impressions: 1_756_519,
        ctr: 5.3,
        byMonth: [],
        children: [],
      },
    ],
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Analytics (редизајн)', () => {
  it('прикажува секции по извор + ад хиерархија за избран клиент', async () => {
    mockFetch({ '/clients': CLIENTS, '/analytics/client/cl1': DATA });
    renderWithProviders(<Analytics />);
    expect(await screen.findByText('Instagram (органски)')).toBeTruthy();
    expect(screen.getByText('Facebook (страница)')).toBeTruthy();
    expect(screen.getByText('Реклами (платено)')).toBeTruthy();
    expect(screen.getByText('Промо недела')).toBeTruthy();
  });
});
