import type { TriggerType } from '@gd/core';
import { prisma } from '../../db/tenantExtension.js';
import { logger } from '../../lib/logger.js';
import { EVALUATORS, type RuleRow } from './evaluators.js';

/**
 * Rule Builder engine (H3, ADR-001). Ги зема сите ВКЛУЧЕНИ правила, dispatch-ира по
 * `trigger.type` до типизиран евалуатор, логира `AutomationRun`. Евалуаторите само
 * известуваат — никогаш преод (инваријанта на ADR-001).
 */
export async function runEnabledRules(now = new Date()): Promise<{
  rules: number;
  created: number;
}> {
  const rules = await prisma.automationRule.findMany({ where: { enabled: true } });
  let created = 0;

  for (const rule of rules) {
    const type = (rule.trigger as { type?: string } | null)?.type as TriggerType | undefined;
    const evaluator = type ? EVALUATORS[type] : undefined;
    if (!evaluator) continue; // правила без препознат тип (пр. event-driven или легаси) се прескокнуваат

    try {
      const n = await evaluator(rule as unknown as RuleRow, { now });
      created += n;
      await prisma.automationRun.create({
        data: { ruleId: rule.id, tenantId: rule.tenantId, result: 'ok', detail: { created: n } },
      });
    } catch (err) {
      logger.error({ ruleId: rule.id, err }, 'automation rule evaluation failed');
      await prisma.automationRun.create({
        data: { ruleId: rule.id, tenantId: rule.tenantId, result: 'error' },
      });
    }
  }

  return { rules: rules.length, created };
}
