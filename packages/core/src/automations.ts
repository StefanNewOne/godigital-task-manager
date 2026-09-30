import { z } from 'zod';
import { TASK_STATUSES } from './statuses.js';

/**
 * Rule Builder (H3, ADR-001) — ОГРАНИЧЕН, типизиран, data-driven аларм engine.
 * Фиксен регистар на тип-тригери; правилата носат ВАЛИДИРАНИ параметри, не код.
 * Евалуаторите (API) само читаат состојба и креираат Notification — НИКОГАШ преод.
 */

/** Фиксен сет тип-тригери (секој има кодиран евалуатор во API). */
export const TRIGGER_TYPES = [
  'coverage_below', // покриеност на клиент под праг (денови)
  'status_age_exceeds', // таск престоил во статус подолго од праг
  'deadline_approaching', // рок за статус наближува (денови пред)
  'client_return_nth', // n-то враќање од клиент
  'scenarios_exceed_slots', // одобрени сценарија > резервирани слотови
  'storage_quota', // сторидж квота над праг (%)
  'meta_token_expired', // истечен Meta токен
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

/** Дискриминирана унија: тип + неговите валидирани услови (trigger+conditions заедно). */
export const ruleSpecSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('coverage_below'),
    days: z.number().int().min(1, 'Најмалку 1 ден.').max(365),
  }),
  z.object({
    type: z.literal('status_age_exceeds'),
    days: z.number().int().min(1, 'Најмалку 1 ден.').max(365),
    statuses: z.array(z.enum(TASK_STATUSES)).min(1, 'Избери барем еден статус.'),
  }),
  z.object({
    type: z.literal('deadline_approaching'),
    daysBefore: z.number().int().min(0).max(60),
  }),
  z.object({
    type: z.literal('client_return_nth'),
    n: z.number().int().min(1).max(20),
  }),
  z.object({ type: z.literal('scenarios_exceed_slots') }),
  z.object({
    type: z.literal('storage_quota'),
    pct: z.number().int().min(1).max(100),
  }),
  z.object({ type: z.literal('meta_token_expired') }),
]);
export type RuleSpec = z.infer<typeof ruleSpecSchema>;

/** Кого известува правилото (ограничен сет; се резолвира во API). */
export const RECIPIENT_KINDS = ['directors', 'owner', 'accountManagers'] as const;
export type RecipientKind = (typeof RECIPIENT_KINDS)[number];

/** Ниво на известување (се совпаѓа со `Notification.level`). */
export const NOTIFY_LEVELS = ['potsetnik', 'alarm', 'kritichen'] as const;
export type NotifyLevel = (typeof NOTIFY_LEVELS)[number];

export const ruleActionSchema = z.object({
  level: z.enum(NOTIFY_LEVELS),
  recipients: z.enum(RECIPIENT_KINDS),
});
export type RuleAction = z.infer<typeof ruleActionSchema>;

/** Целосен влез за создавање/уредување правило (споделено FE/BE). */
export const automationRuleInputSchema = z
  .object({
    name: z.string().min(1, 'Името е задолжително.'),
    scope: z.enum(['global', 'client']).default('global'),
    clientId: z.string().uuid().nullable().optional(),
    spec: ruleSpecSchema,
    action: ruleActionSchema,
    enabled: z.boolean().default(true),
  })
  .refine((r) => r.scope !== 'client' || !!r.clientId, {
    message: 'Правило со опсег „клиент" мора да има избран клиент.',
    path: ['clientId'],
  });
export type AutomationRuleInput = z.infer<typeof automationRuleInputSchema>;
