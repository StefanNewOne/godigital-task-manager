import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { CampaignsManager } from './CampaignsManager.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CampaignsManager', () => {
  it('прикажува клиент-избор и кампањи за избраниот клиент', async () => {
    mockFetch({
      '/clients': [{ id: 'c1', name: 'Ресторан ИВ', color: '#0D9488' }],
      '/campaigns': [
        {
          id: 'k1',
          clientId: 'c1',
          name: 'Есенска колекција',
          objective: 'reach',
          budget: '450',
          periodFrom: '2026-09-15T00:00:00.000Z',
          periodTo: '2026-09-30T00:00:00.000Z',
          status: 'active',
          metaCampaignId: null,
          client: { name: 'Ресторан ИВ', color: '#0D9488' },
        },
      ],
    });
    renderWithProviders(<CampaignsManager onClose={() => {}} />);

    expect(await screen.findByText('Есенска колекција')).toBeTruthy();
    expect(screen.getByText('Кампањи')).toBeTruthy();
    expect(screen.getByRole('button', { name: '+ Нова кампања' })).toBeTruthy();
  });
});
