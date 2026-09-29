import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../../test/utils.js';
import { CreativeViewer } from './CreativeViewer.js';

/** Handoff v2 §44: изборот на верзија ја отвора избраната; заглавјето означува „· претходна". */
const FILES = [
  {
    id: 'f1',
    kind: 'final',
    version: 1,
    mime: 'image/png',
    url: 'http://x/1',
    ownerType: 'task',
    ownerId: 't1',
  },
  {
    id: 'f2',
    kind: 'final',
    version: 2,
    mime: 'image/png',
    url: 'http://x/2',
    ownerType: 'task',
    ownerId: 't1',
  },
];

function routes() {
  return {
    '/me': {
      id: 'u1',
      name: 'Режисер Р.',
      email: 'r@g.mk',
      role: 'rez',
      isScenaristToo: false,
      color: '#0866FF',
      active: true,
      lastActiveAt: null,
    },
    '/tasks/t1': {
      id: 't1',
      clientId: 'cl1',
      status: 'vnatresno',
      contentType: 'video',
      title: 'Тест',
      client: { name: 'Клиент', usesMetaAds: false },
    },
    '/tasks/t1/activity': [],
    '/employees': [],
    '/files': FILES,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CreativeViewer · верзии (§44)', () => {
  it('стандардно ја отвора последната верзија без ознака „претходна"', async () => {
    mockFetch(routes());
    renderWithProviders(<CreativeViewer taskId="t1" onClose={() => {}} />);
    // Кога верзиите се вчитани, се појавува сликичка v1; заглавјето е на последната (v2) без „претходна".
    await screen.findByTitle('v1');
    expect(screen.queryByText(/претходна/)).toBeNull();
  });

  it('клик на постара верзија ја отвора неа и покажува „· претходна"', async () => {
    mockFetch(routes());
    renderWithProviders(<CreativeViewer taskId="t1" onClose={() => {}} />);
    const thumb = await screen.findByTitle('v1');
    fireEvent.click(thumb);
    expect(await screen.findByText(/v1 · претходна/)).toBeTruthy();
  });
});
