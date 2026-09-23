import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { TASK_STATUS_META } from '@gd/core';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { Overview } from './Overview.js';
import type { OverviewData } from '../api/overview.js';

const DATA: OverviewData = {
  coverage: [
    {
      clientId: 'c1',
      name: 'Клиент Еден',
      color: '#f00',
      video: 12,
      graphic: 8,
      days: 12,
      level: 'warn',
    },
    {
      clientId: 'c2',
      name: 'Клиент Два',
      color: '#0f0',
      video: 3,
      graphic: null,
      days: 3,
      level: 'danger',
    },
  ],
  byStatus: [{ status: 'dizajn', count: 4 }],
  alarms: [],
  campaigns: [],
};

afterEach(() => vi.unstubAllGlobals());

describe('Overview', () => {
  it('прикажува покриеност по клиент и работа по статус', async () => {
    mockFetch({ '/overview': DATA });
    renderWithProviders(<Overview />);

    expect(await screen.findByText('Клиент Еден')).toBeTruthy();
    expect(screen.getByText('Клиент Два')).toBeTruthy();
    expect(screen.getByText('12 дена')).toBeTruthy();
    // статус беџ од TASK_STATUS_META
    expect(screen.getByText(TASK_STATUS_META.dizajn.label)).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
  });

  it('најлошата покриеност е прва (сортирано по денови растечки)', async () => {
    mockFetch({ '/overview': DATA });
    renderWithProviders(<Overview />);
    await screen.findByText('Клиент Еден');
    const names = screen.getAllByText(/Клиент /).map((el) => el.textContent);
    // c2 (3 дена) пред c1 (12 дена)
    expect(names.indexOf('Клиент Два')).toBeLessThan(names.indexOf('Клиент Еден'));
  });
});
