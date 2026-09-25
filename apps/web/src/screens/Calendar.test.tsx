import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { Calendar } from './Calendar.js';

const now = new Date();
const month = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
const todayISO = `${month}-${String(now.getUTCDate()).padStart(2, '0')}`;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Calendar · Сите клиенти', () => {
  it('глобален приказ: опција „Сите клиенти" + таскови по клиент во ден-панелот', async () => {
    mockFetch({
      '/clients': [
        { id: 'c1', name: 'Ресторан ИВ', color: '#0D9488' },
        { id: 'c2', name: 'Астибо', color: '#7C3AED' },
      ],
      '/holidays': [],
      '/slots/all': [
        {
          id: 's1',
          clientId: 'c1',
          contentType: 'video',
          date: `${todayISO}T00:00:00.000Z`,
          orderInDay: 1,
          status: 'reserved',
          monthKey: month,
          task: { id: 't1', status: 'montaza', title: 'Ресторан V-1', contentType: 'video' },
        },
      ],
    });
    renderWithProviders(<Calendar />);

    // Опцијата „Сите клиенти" постои и е избрана (default).
    const opt = (await screen.findByText('Сите клиенти')) as HTMLOptionElement;
    expect(opt).toBeTruthy();
    // Ден-панелот (default = денес) го покажува таскот со име на клиент.
    expect(await screen.findByText(/Ресторан ИВ · Ресторан V-1/)).toBeTruthy();
  });
});
