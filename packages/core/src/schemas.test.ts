import { describe, expect, it } from 'vitest';
import {
  calendarConfigSchema,
  campaignCreateSchema,
  clientCreateSchema,
  employeeCreateSchema,
  holidayCreateSchema,
  loginSchema,
} from './schemas.js';

describe('schemas', () => {
  it('loginSchema бара валиден е-мејл и лозинка', () => {
    expect(loginSchema.safeParse({ email: 'a@b.mk', password: 'x' }).success).toBe(true);
    expect(loginSchema.safeParse({ email: 'nevaliden', password: 'x' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.mk', password: '' }).success).toBe(false);
  });

  it('employeeCreateSchema: isScenaristToo дозволено само за rez', () => {
    const base = { name: 'Т', email: 't@g.mk', password: '12345678', color: '#000' };
    expect(
      employeeCreateSchema.safeParse({ ...base, role: 'rez', isScenaristToo: true }).success,
    ).toBe(true);
    expect(
      employeeCreateSchema.safeParse({ ...base, role: 'mon', isScenaristToo: true }).success,
    ).toBe(false);
    expect(employeeCreateSchema.safeParse({ ...base, role: 'mon' }).success).toBe(true);
  });

  it('employeeCreateSchema бара лозинка ≥ 8 знаци', () => {
    const r = employeeCreateSchema.safeParse({
      name: 'Т',
      email: 't@g.mk',
      password: 'short',
      color: '#000',
      role: 'am',
    });
    expect(r.success).toBe(false);
  });

  it('clientCreateSchema применува default вредности', () => {
    const r = clientCreateSchema.safeParse({
      name: 'Клиент',
      color: '#000',
      contractStart: '2026-01-01',
      contractMonths: 12,
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.videosPerMonth).toBe(0);
      expect(r.data.usesMetaAds).toBe(false);
      expect(r.data.calendarType).toBe('standarden');
      expect(r.data.coverageAlarmDays).toBe(7);
    }
  });

  it('calendarConfigSchema бара HH:mm и барем еден ден', () => {
    expect(
      calendarConfigSchema.safeParse({
        contentType: 'video',
        weekdays: [2, 5],
        publishTime: '12:00',
      }).success,
    ).toBe(true);
    expect(
      calendarConfigSchema.safeParse({ contentType: 'video', weekdays: [], publishTime: '12:00' })
        .success,
    ).toBe(false);
    expect(
      calendarConfigSchema.safeParse({ contentType: 'video', weekdays: [2], publishTime: '12h' })
        .success,
    ).toBe(false);
  });

  it('holidayCreateSchema прифаќа датум и име', () => {
    expect(holidayCreateSchema.safeParse({ date: '2026-09-08', name: 'Празник' }).success).toBe(
      true,
    );
  });

  it('campaignCreateSchema: coerce на буџет/датуми, default статус planned', () => {
    const r = campaignCreateSchema.safeParse({
      clientId: '00000000-0000-7000-8000-000000000000',
      name: 'Есенска',
      objective: 'reach',
      budget: '450',
      periodFrom: '2026-09-15',
      periodTo: '2026-09-30',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.budget).toBe(450);
      expect(r.data.status).toBe('planned');
      expect(r.data.periodFrom).toBeInstanceOf(Date);
    }
    expect(campaignCreateSchema.safeParse({ name: 'x' }).success).toBe(false);
  });
});
