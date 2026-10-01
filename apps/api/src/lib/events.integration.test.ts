import { describe, expect, it, vi } from 'vitest';
import { recordEvent, type EventInput } from './events.js';
import type { TxClient } from '../db/tenantExtension.js';

/** G3 — И2 (§4.12): recordEvent одбива празен наратив пред да допре до базата (нема EventLog без наратив). */
describe('G3 · recordEvent гард за наратив', () => {
  const base: Omit<EventInput, 'narrative'> = {
    eventType: 'task.transition',
    objectType: 'task',
    objectId: '00000000-0000-7000-8000-000000000000',
  };
  // Фиктивен tx што би фрлил ако се допре — гардот мора да спречи пред тоа.
  const tx = {
    eventLog: {
      create: vi.fn(() => {
        throw new Error('не треба да се повика');
      }),
    },
  } as unknown as TxClient;

  it('празен наратив → фрла, базата не се допира', async () => {
    await expect(recordEvent(tx, { ...base, narrative: '' })).rejects.toThrow(/наратив/);
    await expect(recordEvent(tx, { ...base, narrative: '   ' })).rejects.toThrow(/наратив/);
  });
});
