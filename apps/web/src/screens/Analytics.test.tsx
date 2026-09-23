import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Analytics } from './Analytics.js';

describe('Analytics', () => {
  it('прикажува празна состојба до Фаза B2', () => {
    render(<Analytics />);
    expect(screen.getByText('Аналитика')).toBeTruthy();
    expect(screen.getByText(/Фаза B2/)).toBeTruthy();
  });
});
