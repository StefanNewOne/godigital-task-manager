import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../../test/utils.js';
import { TaskDetail } from './TaskDetail.js';
import type { Me, TaskDetailData } from '../../lib/types.js';

const TASK: TaskDetailData = {
  id: 't1',
  clientId: 'cl1',
  groupId: 'g1',
  contentType: 'video',
  title: 'Ресторан ИВ V-9-3',
  status: 'vnatresno',
  assigneeId: null,
  priority: 'normalen',
  version: 2,
  statusChangedAt: '2026-09-20T00:00:00.000Z',
  slot: { date: '2026-09-22T00:00:00.000Z', orderInDay: 1, status: 'used' },
  _count: { comments: 0, publications: 0 },
  brief: null,
  copy: null,
  rezId: null,
  kreaId: null,
  client: { name: 'Ресторан ИВ', usesMetaAds: true },
  publications: [],
};

const meWith = (role: Me['role']): Me => ({
  id: role === 'rez' ? 'u-rez' : 'u-dir',
  name: role === 'rez' ? 'Режисер Р.' : 'Алекс К.',
  email: `${role}@godigital.mk`,
  role,
  isScenaristToo: false,
  color: '#0866FF',
  active: true,
  lastActiveAt: null,
});

/** Заеднички рути за Task Detail (me се менува по тест). */
function routes(me: Me) {
  return {
    '/me': me,
    '/tasks/t1': TASK,
    '/tasks/t1/activity': [],
    '/employees': [],
    '/clients': [{ id: 'cl1', name: 'Ресторан ИВ', color: '#0D9488' }],
    '/files': [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('TaskDetail · работна зона', () => {
  it('Директор во туѓа зона гледа поле за причина (D-5)', async () => {
    mockFetch(routes(meWith('dir')));
    renderWithProviders(<TaskDetail taskId="t1" onClose={() => {}} />);

    // Работната зона на vnatresno видео ја носи Режисер → Директорот дејствува наместо.
    expect(await screen.findByText(/Дејствуваш наместо Режисер/)).toBeTruthy();
    expect(screen.getByText('Причина · задолжително')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Одобри' })).toBeTruthy();
  });

  it('Носителот на статусот (Режисер) нема поле за причина', async () => {
    mockFetch(routes(meWith('rez')));
    renderWithProviders(<TaskDetail taskId="t1" onClose={() => {}} />);

    // Работната зона е интерактивна, но без D-5 барање за причина.
    expect(await screen.findByRole('button', { name: 'Одобри' })).toBeTruthy();
    expect(screen.queryByText(/Дејствуваш наместо/)).toBeNull();
  });
});
