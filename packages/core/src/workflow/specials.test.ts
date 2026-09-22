import { describe, expect, it } from 'vitest';
import { canCancel, canPause, canReactivateMissed, canResumeFromPause } from './specials.js';

describe('special transitions', () => {
  it('пауза: само dir/am, не-терминален, не mrtov/pauza', () => {
    expect(canPause('montaza', 'dir')).toBe(true);
    expect(canPause('montaza', 'am')).toBe(true);
    expect(canPause('montaza', 'rez')).toBe(false);
    expect(canPause('mrtov', 'dir')).toBe(false);
    expect(canPause('pauza', 'dir')).toBe(false);
    expect(canPause('zavrseno', 'dir')).toBe(false);
    expect(canPause('objaveno', 'am')).toBe(false);
  });

  it('откажан: само dir, не-терминален', () => {
    expect(canCancel('montaza', 'dir')).toBe(true);
    expect(canCancel('montaza', 'am')).toBe(false);
    expect(canCancel('otkazano', 'dir')).toBe(false);
    expect(canCancel('zavrseno', 'dir')).toBe(false);
  });

  it('реактивација на пропуштен слот: dir/am секогаш, rez видео, krea графика', () => {
    expect(canReactivateMissed('dir', 'video')).toBe(true);
    expect(canReactivateMissed('am', 'graphic')).toBe(true);
    expect(canReactivateMissed('rez', 'video')).toBe(true);
    expect(canReactivateMissed('rez', 'graphic')).toBe(false);
    expect(canReactivateMissed('krea', 'graphic')).toBe(true);
    expect(canReactivateMissed('krea', 'video')).toBe(false);
    expect(canReactivateMissed('mon', 'video')).toBe(false);
  });

  it('враќање од пауза: само dir/am', () => {
    expect(canResumeFromPause('dir')).toBe(true);
    expect(canResumeFromPause('am')).toBe(true);
    expect(canResumeFromPause('rez')).toBe(false);
  });
});
