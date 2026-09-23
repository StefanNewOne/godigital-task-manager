import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Analytics } from './Analytics.js';

describe('Analytics', () => {
  it('прикажува KPI картички и распоред по Handoff', () => {
    render(<Analytics />);
    expect(screen.getByText('Досег')).toBeTruthy();
    expect(screen.getByText('Органски наспроти платено')).toBeTruthy();
    expect(screen.getByText('Кампањи во тек')).toBeTruthy();
    expect(screen.getByText('Топ објави по ангажман')).toBeTruthy();
  });
});
