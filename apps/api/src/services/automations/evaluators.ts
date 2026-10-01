import type { TriggerType, RuleAction, RecipientKind } from '@gd/core';
import { ruleActionSchema } from '@gd/core';
import { prisma } from '../../db/tenantExtension.js';
import { clientCoverageDays } from '../coverageQuery.js';
import { createNotification } from '../notifications.js';

/**
 * Rule Builder евалуатори (H3, ADR-001). Секој тип-тригер има евалуатор што САМО чита состојба
 * и креира `Notification` — НИКОГАШ не менува статус/не прави преод (инваријанта на ADR-001).
 */

export interface RuleRow {
  id: string;
  name: string;
  scope: string;
  clientId: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  trigger: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  actions: any;
}
export interface EvalCtx {
  now: Date;
}
/** Враќа број создадени известувања. */
export type Evaluator = (rule: RuleRow, ctx: EvalCtx) => Promise<number>;

/** Резолвира приматели во листа employee id-а (ограничен сет, ADR-001). */
async function resolveRecipients(kind: RecipientKind): Promise<string[]> {
  if (kind === 'directors') {
    const dirs = await prisma.employee.findMany({ where: { role: 'dir', active: true } });
    return dirs.map((d) => d.id);
  }
  if (kind === 'accountManagers') {
    const ams = await prisma.employee.findMany({ where: { role: 'am', active: true } });
    return ams.map((a) => a.id);
  }
  return []; // 'owner' не е применливо за клиент-ниво тригери (coverage); се користи кај таск тригери
}

function parseAction(raw: unknown): RuleAction | null {
  const p = ruleActionSchema.safeParse(raw);
  return p.success ? p.data : null;
}

/** coverage_below — покриеност на клиент под неговиот праг → известување (data-driven по правило). */
const coverageBelow: Evaluator = async (rule, { now }) => {
  const action = parseAction(rule.actions) ?? { level: 'kritichen', recipients: 'directors' };
  const recipients = await resolveRecipients(action.recipients);
  if (recipients.length === 0) return 0;

  const coverage = await clientCoverageDays(now);
  let created = 0;
  for (const c of coverage) {
    if (c.days >= c.threshold) continue;
    if (rule.scope === 'client' && rule.clientId && rule.clientId !== c.clientId) continue;
    for (const recipientId of recipients) {
      const n = await createNotification({
        recipientId,
        level: action.level,
        eventKey: 'coverage_low',
        clientId: c.clientId,
        title: `Ниска покриеност: ${c.name}`,
        body: `Покриеноста за „${c.name}" е ${c.days} дена (праг ${c.threshold}).`,
      });
      if (n) created++;
    }
  }
  return created;
};

/** Евалуатори за cron-скенливите типови. Останатите се event-driven (effects) или идни. */
const noop: Evaluator = async () => 0;

export const EVALUATORS: Record<TriggerType, Evaluator> = {
  coverage_below: coverageBelow,
  // TODO(automations): status_age/deadline/storage се додаваат во следна итерација;
  // client_return_nth и scenarios_exceed_slots се подигаат во transition effects (E_ALARM).
  status_age_exceeds: noop,
  deadline_approaching: noop,
  client_return_nth: noop,
  scenarios_exceed_slots: noop,
  storage_quota: noop,
  meta_token_expired: noop,
};
