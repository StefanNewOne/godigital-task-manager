// Vitest setup за web компонентни тестови (jsdom).
// RTL авто-cleanup по секој тест за да нема протекување DOM меѓу тестови.
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
