import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../test/utils.js';
import { AssistantPanel } from './AssistantPanel.js';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('AssistantPanel', () => {
  it('прашање враќа заземен одговор со извори', async () => {
    mockFetch({
      '/knowledge/assistant/ask': {
        answer: 'Таскот доцни поради враќање од клиент.',
        grounded: true,
        sources: [{ sourceType: 'eventNarrative', sourceId: 'e1', text: 'Вратен од клиент.' }],
      },
    });
    renderWithProviders(<AssistantPanel onClose={() => {}} />);

    fireEvent.change(screen.getByPlaceholderText(/Зошто доцни/), {
      target: { value: 'Зошто доцни таскот?' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Прашај' }));

    expect(await screen.findByText(/Таскот доцни поради враќање/)).toBeTruthy();
    expect(screen.getByText('Извори')).toBeTruthy();
    expect(screen.getByText('eventNarrative')).toBeTruthy();
  });

  it('копчето Прашај е оневозможено при празно прашање', () => {
    mockFetch({});
    renderWithProviders(<AssistantPanel onClose={() => {}} />);
    const btn = screen.getByRole('button', { name: 'Прашај' }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });
});
