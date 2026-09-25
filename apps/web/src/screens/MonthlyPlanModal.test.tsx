import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { MonthlyPlanModal } from './MonthlyPlanModal.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('MonthlyPlanModal', () => {
  it('прикажува клиенти со toggle + копче Потврди месец', async () => {
    mockFetch({
      '/monthly-plan/2026-11': {
        monthKey: '2026-11',
        confirmed: false,
        confirmedAt: null,
        clients: [
          { clientId: 'c1', name: 'Ресторан ИВ', color: '#0D9488', active: true },
          { clientId: 'c2', name: 'Голд Хотел', color: '#65A30D', active: false },
        ],
      },
    });
    renderWithProviders(<MonthlyPlanModal month="2026-11" onClose={() => {}} />);

    expect(await screen.findByText('Ресторан ИВ')).toBeTruthy();
    expect(screen.getByText('Голд Хотел')).toBeTruthy();
    expect(screen.getByText(/Месечен план · Ноември 2026/)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Потврди месец' })).toBeTruthy();
    // Toggle-и (role=switch) со точна почетна состојба.
    const resto = screen.getByRole('switch', { name: 'Ресторан ИВ' }) as HTMLButtonElement;
    expect(resto.getAttribute('aria-checked')).toBe('true');
    const gold = screen.getByRole('switch', { name: 'Голд Хотел' }) as HTMLButtonElement;
    expect(gold.getAttribute('aria-checked')).toBe('false');
  });
});
