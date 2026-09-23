import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import { PERMISSIONS, ROLE_LABEL, ROLES } from '@gd/core';
import { AdminPermissions } from './RolesPermissions.js';

describe('AdminPermissions', () => {
  it('рендерира ред за секоја улога од @gd/core', () => {
    render(<AdminPermissions />);
    for (const role of ROLES) {
      expect(screen.getByText(ROLE_LABEL[role])).toBeTruthy();
    }
  });

  it('опсегот се чита од PERMISSIONS (Сите/Свои)', () => {
    render(<AdminPermissions />);
    const dir = screen.getByText(ROLE_LABEL.dir).closest('tr');
    expect(dir).toBeTruthy();
    // Директорот има scope 'all' → „Сите"
    expect(within(dir!).getByText(PERMISSIONS.dir.scope === 'all' ? 'Сите' : 'Свои')).toBeTruthy();
  });

  it('колоната „Носи статуси" ги наведува статусите на улогата', () => {
    render(<AdminPermissions />);
    const owned = [...PERMISSIONS.rez.ownsTaskStatuses, ...PERMISSIONS.rez.ownsCapaStatuses];
    if (owned.length > 0) {
      const rezRow = screen.getByText(ROLE_LABEL.rez).closest('tr');
      expect(within(rezRow!).getByText(owned.join(', '))).toBeTruthy();
    }
  });
});
