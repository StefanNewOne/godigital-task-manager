import { describe, expect, it } from 'vitest';
import {
  TRIGGER_TYPES,
  RECIPIENT_KINDS,
  NOTIFY_LEVELS,
  ruleSpecSchema,
  ruleActionSchema,
  automationRuleInputSchema,
} from './automations.js';

describe('automations (Rule Builder, ADR-001)', () => {
  it('регистарот на тригери + сетовите се стабилни', () => {
    expect(TRIGGER_TYPES).toContain('coverage_below');
    expect(TRIGGER_TYPES).toContain('meta_token_expired');
    expect(RECIPIENT_KINDS).toEqual(['directors', 'owner', 'accountManagers']);
    expect(NOTIFY_LEVELS).toEqual(['potsetnik', 'alarm', 'kritichen']);
  });

  it('ruleSpecSchema прифаќа валиден спец по секој тип', () => {
    expect(ruleSpecSchema.safeParse({ type: 'coverage_below', days: 7 }).success).toBe(true);
    expect(
      ruleSpecSchema.safeParse({ type: 'status_age_exceeds', days: 3, statuses: ['montaza'] })
        .success,
    ).toBe(true);
    expect(ruleSpecSchema.safeParse({ type: 'deadline_approaching', daysBefore: 2 }).success).toBe(
      true,
    );
    expect(ruleSpecSchema.safeParse({ type: 'client_return_nth', n: 3 }).success).toBe(true);
    expect(ruleSpecSchema.safeParse({ type: 'scenarios_exceed_slots' }).success).toBe(true);
    expect(ruleSpecSchema.safeParse({ type: 'storage_quota', pct: 80 }).success).toBe(true);
    expect(ruleSpecSchema.safeParse({ type: 'meta_token_expired' }).success).toBe(true);
  });

  it('ruleSpecSchema одбива невалидни параметри / непознат тип', () => {
    expect(ruleSpecSchema.safeParse({ type: 'coverage_below', days: 0 }).success).toBe(false);
    expect(ruleSpecSchema.safeParse({ type: 'coverage_below' }).success).toBe(false);
    expect(
      ruleSpecSchema.safeParse({ type: 'status_age_exceeds', days: 3, statuses: [] }).success,
    ).toBe(false);
    expect(ruleSpecSchema.safeParse({ type: 'storage_quota', pct: 150 }).success).toBe(false);
    expect(ruleSpecSchema.safeParse({ type: 'nepostoi' }).success).toBe(false);
  });

  it('ruleActionSchema валидира ниво + приматели', () => {
    expect(
      ruleActionSchema.safeParse({ level: 'kritichen', recipients: 'directors' }).success,
    ).toBe(true);
    expect(ruleActionSchema.safeParse({ level: 'nema', recipients: 'directors' }).success).toBe(
      false,
    );
    expect(ruleActionSchema.safeParse({ level: 'alarm', recipients: 'nekoj' }).success).toBe(false);
  });

  it('automationRuleInputSchema: global со default enabled', () => {
    const r = automationRuleInputSchema.safeParse({
      name: 'Тест',
      spec: { type: 'coverage_below', days: 7 },
      action: { level: 'kritichen', recipients: 'directors' },
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.scope).toBe('global');
      expect(r.data.enabled).toBe(true);
    }
  });

  it('automationRuleInputSchema: client опсег бара clientId', () => {
    const base = {
      name: 'Тест',
      scope: 'client' as const,
      spec: { type: 'coverage_below', days: 10 },
      action: { level: 'alarm', recipients: 'accountManagers' },
    };
    expect(automationRuleInputSchema.safeParse(base).success).toBe(false);
    expect(
      automationRuleInputSchema.safeParse({
        ...base,
        clientId: '01a0cdb4-0b1a-7583-b14e-7343d78815f6',
      }).success,
    ).toBe(true);
  });

  it('automationRuleInputSchema: празно име одбиено', () => {
    expect(
      automationRuleInputSchema.safeParse({
        name: '',
        spec: { type: 'scenarios_exceed_slots' },
        action: { level: 'kritichen', recipients: 'directors' },
      }).success,
    ).toBe(false);
  });
});
