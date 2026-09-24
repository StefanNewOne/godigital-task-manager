import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { Settings } from './Settings.js';
import type { Me } from '../lib/types.js';

const ME: Me = {
  id: 'e1',
  name: 'Стефан Режисер',
  email: 'stefan@godigital.mk',
  role: 'rez',
  isScenaristToo: false,
  color: '#0D9488',
  active: true,
  lastActiveAt: null,
  notificationPrefs: { reminders: true },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Settings', () => {
  it('го прикажува toggle-от вклучен и задолжителните нивоа заклучени', async () => {
    mockFetch({ '/me': ME });
    renderWithProviders(<Settings />);

    const toggle = await screen.findByRole('switch', { name: 'Потсетници' });
    expect(toggle.getAttribute('aria-checked')).toBe('true');
    // alarm/kritичен не се исклучуваат
    expect(screen.getAllByText('Секогаш вклучено')).toHaveLength(2);
  });

  it('исклучувањето на потсетниците праќа PATCH со reminders:false', async () => {
    const fetchMock = mockFetch({ '/me': ME, '/me/notification-prefs': { reminders: false } });
    renderWithProviders(<Settings />);

    const toggle = await screen.findByRole('switch', { name: 'Потсетници' });
    fireEvent.click(toggle);

    await waitFor(() => {
      const patched = fetchMock.mock.calls.some(([url, init]) => {
        const u = typeof url === 'string' ? url : String(url);
        const opts = init as RequestInit | undefined;
        return (
          u.includes('/me/notification-prefs') &&
          opts?.method === 'PATCH' &&
          String(opts?.body).includes('"reminders":false')
        );
      });
      expect(patched).toBe(true);
    });
  });
});
