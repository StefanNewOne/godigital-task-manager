import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders, mockFetch } from '../../test/utils.js';
import { CapaPanel } from './CapaPanel.js';
import type { Me, TaskGroupDetail } from '../../lib/types.js';

const GROUP: TaskGroupDetail = {
  id: 'g1',
  clientId: 'cl1',
  contentType: 'video',
  monthKey: '2026-09',
  status: 'scenarija', // ја носи Сценарист
  scenaristId: 'u-scen',
  rezId: null,
  kamId: null,
  shootDate: null,
  shootLocation: null,
  scenaristNotes: null,
  plannedCount: 4,
  scenarioDocVersion: 1,
  scenariosTotal: 0,
  scenariosApproved: 0,
  rawDeleteAt: null,
  localArchivePath: null,
  client: { name: 'Ресторан ИВ' },
  totalChildren: 4,
  activeChildren: 0,
  sharedFiles: 0,
};

const meWith = (role: Me['role']): Me => ({
  id: role === 'scen' ? 'u-scen' : 'u-dir',
  name: role === 'scen' ? 'Сценарист С.' : 'Алекс К.',
  email: `${role}@godigital.mk`,
  role,
  isScenaristToo: false,
  color: '#0866FF',
  active: true,
  lastActiveAt: null,
});

function routes(me: Me) {
  return {
    '/me': me,
    '/task-groups/g1': GROUP,
    '/task-groups/g1/scenarios': [],
    '/employees': [],
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('CapaPanel · D-5', () => {
  it('Директор во туѓа капа-зона гледа поле за причина (#3)', async () => {
    mockFetch(routes(meWith('dir')));
    renderWithProviders(<CapaPanel groupId="g1" onClose={() => {}} />);

    expect(await screen.findByText(/Дејствуваш наместо Сценарист/)).toBeTruthy();
    expect(screen.getByText('Причина · задолжително')).toBeTruthy();
  });

  it('Носителот (Сценарист) нема поле за причина', async () => {
    mockFetch(routes(meWith('scen')));
    renderWithProviders(<CapaPanel groupId="g1" onClose={() => {}} />);

    // Зоната се вчитува (наслов на капата), но без D-5 барање.
    expect(await screen.findByText('Ресторан ИВ')).toBeTruthy();
    expect(screen.queryByText(/Дејствуваш наместо/)).toBeNull();
  });
});
