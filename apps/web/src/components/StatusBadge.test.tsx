import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TASK_STATUS_META, type TaskStatus } from '@gd/core';
import { StatusBadge } from './StatusBadge.js';

describe('StatusBadge', () => {
  it('прикажува кирилска етикета од TASK_STATUS_META', () => {
    const label = TASK_STATUS_META.dizajn.label;
    render(<StatusBadge status="dizajn" />);
    expect(screen.getByText(label)).toBeTruthy();
  });

  it('за непознат статус паѓа назад на самиот клуч', () => {
    render(<StatusBadge status="nepoznat" />);
    expect(screen.getByText('nepoznat')).toBeTruthy();
  });

  it('рендерира етикета за секој таск статус', () => {
    const statuses = Object.keys(TASK_STATUS_META) as TaskStatus[];
    for (const s of statuses) {
      const { unmount } = render(<StatusBadge status={s} />);
      expect(screen.getByText(TASK_STATUS_META[s].label)).toBeTruthy();
      unmount();
    }
  });
});
