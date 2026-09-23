import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { renderWithProviders } from '../test/utils.js';
import { Login } from './Login.js';

function okFetch() {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ data: { accessToken: 'tok', employee: { id: 'e1' } } }),
  });
}

describe('Login', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('прикажува наслов и полиња', () => {
    vi.stubGlobal('fetch', okFetch());
    const { container } = renderWithProviders(<Login />);
    expect(screen.getByText('GoDigital Таск-менаџер')).toBeTruthy();
    expect(container.querySelector('input[type="email"]')).toBeTruthy();
    expect(container.querySelector('input[type="password"]')).toBeTruthy();
  });

  it('празно поднесување → валидациска грешка, без мрежен повик', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderWithProviders(<Login />);

    fireEvent.submit(container.querySelector('form')!);

    expect(await screen.findByText('Неважечки е-мејл.')).toBeTruthy();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('валидно поднесување → POST /api/auth/login со внесот', async () => {
    const fetchMock = okFetch();
    vi.stubGlobal('fetch', fetchMock);
    const { container } = renderWithProviders(<Login />);

    fireEvent.change(container.querySelector('input[type="email"]')!, {
      target: { value: 'dir@godigital.mk' },
    });
    fireEvent.change(container.querySelector('input[type="password"]')!, {
      target: { value: 'lozinka123' },
    });
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const call = fetchMock.mock.calls[0]!;
    const [url, opts] = call as [string, RequestInit];
    expect(url).toBe('/api/auth/login');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body as string)).toEqual({
      email: 'dir@godigital.mk',
      password: 'lozinka123',
    });
  });
});
