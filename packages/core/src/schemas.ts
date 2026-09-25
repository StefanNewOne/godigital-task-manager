import { z } from 'zod';
import { ROLES } from './roles.js';
import { TASK_STATUSES, GROUP_STATUSES } from './statuses.js';

/**
 * Споделени Zod schemas (CLAUDE.md §14): backend валидира со нив, frontend форми ги инферираат.
 * Единствен извор за облик на влез — никогаш дуплиран во api и web.
 */

export const roleSchema = z.enum(ROLES);
export const contentTypeSchema = z.enum(['video', 'graphic']);
export const channelSchema = z.enum(['viber', 'whatsapp', 'email']);
export const calendarTypeSchema = z.enum(['standarden', 'specificen']);

// ── Auth ──
export const loginSchema = z.object({
  email: z.string().email('Неважечки е-мејл.'),
  password: z.string().min(1, 'Лозинката е задолжителна.'),
});
export type LoginInput = z.infer<typeof loginSchema>;

// ── Employee ──
export const employeeCreateSchema = z
  .object({
    name: z.string().min(1, 'Името е задолжително.'),
    email: z.string().email('Неважечки е-мејл.'),
    password: z.string().min(8, 'Лозинката мора да има барем 8 знаци.'),
    phone: z.string().optional(),
    role: roleSchema,
    isScenaristToo: z.boolean().default(false),
    color: z.string().min(1),
    capacityNote: z.string().optional(),
  })
  .refine((v) => !v.isScenaristToo || v.role === 'rez', {
    message: 'isScenaristToo е дозволено само за Режисер.',
    path: ['isScenaristToo'],
  });
export type EmployeeCreateInput = z.infer<typeof employeeCreateSchema>;

export const employeeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  role: roleSchema.optional(),
  isScenaristToo: z.boolean().optional(),
  color: z.string().min(1).optional(),
  active: z.boolean().optional(),
  capacityNote: z.string().optional(),
});
export type EmployeeUpdateInput = z.infer<typeof employeeUpdateSchema>;

// ── Client ──
export const clientCreateSchema = z.object({
  name: z.string().min(1, 'Името е задолжително.'),
  legalName: z.string().optional(),
  color: z.string().min(1),
  contractStart: z.coerce.date(),
  contractMonths: z.number().int().positive(),
  videosPerMonth: z.number().int().min(0).default(0),
  graphicsPerMonth: z.number().int().min(0).default(0),
  usesMetaAds: z.boolean().default(false),
  metaAdAccountId: z.string().optional(),
  metaPageId: z.string().optional(),
  metaIgId: z.string().optional(),
  calendarType: calendarTypeSchema.default('standarden'),
  approvalChannel: channelSchema.default('viber'),
  coverageAlarmDays: z.number().int().positive().default(7),
  notes: z.string().optional(),
  defaultAssignees: z.record(z.string(), z.string()).optional(),
});
export type ClientCreateInput = z.infer<typeof clientCreateSchema>;

export const clientUpdateSchema = clientCreateSchema.partial();
export type ClientUpdateInput = z.infer<typeof clientUpdateSchema>;

// ── Client contacts (A1) ──
export const clientContactCreateSchema = z.object({
  name: z.string().min(1, 'Името е задолжително.'),
  roleAtClient: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email('Неважечки е-мејл.').optional(),
  isApprover: z.boolean().optional(),
});
export type ClientContactCreateInput = z.infer<typeof clientContactCreateSchema>;

export const clientContactUpdateSchema = clientContactCreateSchema
  .partial()
  .extend({ archived: z.boolean().optional() });
export type ClientContactUpdateInput = z.infer<typeof clientContactUpdateSchema>;

// ── CalendarConfig ──
export const calendarConfigSchema = z.object({
  contentType: contentTypeSchema,
  weekdays: z.array(z.number().int().min(1).max(7)).min(1),
  publishTime: z.string().regex(/^\d{2}:\d{2}$/, 'Формат HH:mm.'),
  allowTwoPerDay: z.boolean().default(false),
});
export type CalendarConfigInput = z.infer<typeof calendarConfigSchema>;

// ── Holiday ──
export const holidayCreateSchema = z.object({
  date: z.coerce.date(),
  name: z.string().min(1),
  scope: z.enum(['global', 'client']).default('global'),
  clientId: z.string().uuid().optional(),
});
export type HolidayCreateInput = z.infer<typeof holidayCreateSchema>;

// ── Slots / calendar (A2) ──
const monthKey = z.string().regex(/^\d{4}-\d{2}$/, 'Формат YYYY-MM.');

export const slotGenerateSchema = z.object({ month: monthKey });
export type SlotGenerateInput = z.infer<typeof slotGenerateSchema>;

export const slotConfirmSchema = z.object({ month: monthKey });
export type SlotConfirmInput = z.infer<typeof slotConfirmSchema>;

export const slotPatchSchema = z.object({
  date: z.coerce.date(),
  orderInDay: z.number().int().min(1).max(2).optional(),
});
export type SlotPatchInput = z.infer<typeof slotPatchSchema>;

export const dateChangeSchema = z.object({
  newDate: z.coerce.date(),
  orderInDay: z.number().int().min(1).max(2).optional(),
  reason: z.string().min(1, 'Причината е задолжителна.'),
});
export type DateChangeInput = z.infer<typeof dateChangeSchema>;

// Дополнителен (екстра) таск во постоечка капа (прототип: „Ново видео/графика").
export const extraTaskSchema = z.object({
  clientId: z.string().uuid(),
  contentType: contentTypeSchema,
  title: z.string().min(1, 'Насловот е задолжителен.'),
  date: z.coerce.date(),
});
export type ExtraTaskInput = z.infer<typeof extraTaskSchema>;

// Месечен план на клиенти — Директорот одобрува кои клиенти се работат за месецот.
export const monthlyPlanPutSchema = z.object({
  clients: z.array(z.object({ clientId: z.string().uuid(), active: z.boolean() })),
});
export type MonthlyPlanPutInput = z.infer<typeof monthlyPlanPutSchema>;

// ── State machine transitions (A3) ──
export const transitionPayloadSchema = z
  .object({
    comment: z.string().optional(),
    assigneeId: z.string().uuid().optional(),
    brief: z.string().optional(),
    copy: z.string().optional(),
    outcome: z.enum(['approved', 'approvedWithChanges', 'rejected', 'returned']).optional(),
    channel: channelSchema.optional(),
    reason: z.string().optional(), // за Директор наместо друга улога (D-5)
    // капа полиња (podgotovka → scenarija, PRD §4.3 G_CAPA_FIELDS)
    scenaristId: z.string().uuid().optional(),
    kamId: z.string().uuid().optional(),
    shootDate: z.coerce.date().optional(),
    shootLocation: z.string().optional(),
    scenaristNotes: z.string().optional(),
  })
  .partial();
export type TransitionPayload = z.infer<typeof transitionPayloadSchema>;

export const taskTransitionSchema = z.object({
  to: z.enum(TASK_STATUSES),
  payload: transitionPayloadSchema.optional(),
});
export type TaskTransitionInput = z.infer<typeof taskTransitionSchema>;

export const groupTransitionSchema = z.object({
  to: z.enum(GROUP_STATUSES),
  payload: transitionPayloadSchema.optional(),
});
export type GroupTransitionInput = z.infer<typeof groupTransitionSchema>;

// ── Специјални преоди (A3, PRD §4.3): пауза / откажување / враќање од пауза ──
export const pauseSchema = z.object({ reason: z.string().min(1, 'Причината е задолжителна.') });
export type PauseInput = z.infer<typeof pauseSchema>;

export const cancelSchema = z.object({ reason: z.string().min(1, 'Причината е задолжителна.') });
export type CancelInput = z.infer<typeof cancelSchema>;

export const resumeSchema = z.object({
  newDate: z.coerce.date(),
  orderInDay: z.number().int().min(1).max(2).optional(),
});
export type ResumeInput = z.infer<typeof resumeSchema>;

// ── Сценарија (A4, PRD §4.3 капа видео) ──
export const scenarioSplitSchema = z.object({
  scenarios: z
    .array(
      z.object({
        title: z.string().min(1, 'Насловот е задолжителен.'),
        hook: z.string().optional(),
        body: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .min(1, 'Потребно е барем едно сценарио.'),
});
export type ScenarioSplitInput = z.infer<typeof scenarioSplitSchema>;

export const scenarioOutcomesSchema = z.object({
  items: z
    .array(
      z.object({
        scenarioId: z.string().uuid(),
        status: z.enum(['odobreno', 'odobrenoSoIzmeni', 'otfrleno']),
        clientComment: z.string().optional(),
      }),
    )
    .min(1, 'Потребен е барем еден исход.'),
});
export type ScenarioOutcomesInput = z.infer<typeof scenarioOutcomesSchema>;

export const scenarioUpdateSchema = z.object({
  title: z.string().min(1).optional(),
  hook: z.string().optional(),
  body: z.string().optional(),
  notes: z.string().optional(),
});
export type ScenarioUpdateInput = z.infer<typeof scenarioUpdateSchema>;

// ── Files / uploads (A6, PRD §4.14, §I7) ──
export const filePresignSchema = z.object({
  ownerType: z.enum(['group', 'task', 'revision', 'approval', 'comment']),
  ownerId: z.string().uuid(),
  kind: z.enum([
    'raw',
    'final',
    'graphic',
    'scenarioDoc',
    'briefRef',
    'sharedMaterial',
    'screenshot',
    'preview',
    'logo',
  ]),
  mime: z.string().min(1),
  size: z
    .number()
    .int()
    .positive()
    .max(20 * 1024 * 1024 * 1024), // макс 20 GB
});
export type FilePresignInput = z.infer<typeof filePresignSchema>;

export const fileCompleteSchema = z.object({
  parts: z
    .array(z.object({ PartNumber: z.number().int().positive(), ETag: z.string().min(1) }))
    .min(1),
});
export type FileCompleteInput = z.infer<typeof fileCompleteSchema>;

// ── Publications (A6, PRD §4.8) ──
export const publicationCreateSchema = z.object({
  platform: z.enum(['fb', 'ig', 'tiktok']),
  postType: z.enum(['reel', 'post', 'story', 'carousel']),
  permalink: z.string().url('Неважечки линк.').optional(),
  publishedAt: z.coerce.date().optional(),
});
export type PublicationCreateInput = z.infer<typeof publicationCreateSchema>;

// ── Promotion (A6/B2, PRD §4.8): одлука органски/платено по објава ──
export const promotionCreateSchema = z.object({
  decision: z.enum(['organic', 'paid']),
  rationale: z.string().optional(),
  campaignId: z.string().uuid().optional(),
});
export type PromotionCreateInput = z.infer<typeof promotionCreateSchema>;

// ── Campaign (B2, PRD §4.7): Аналитичар управува со платени кампањи ──
export const campaignCreateSchema = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1, 'Името е задолжително.'),
  objective: z.string().min(1, 'Целта е задолжителна.'),
  budget: z.coerce.number().nonnegative('Буџетот не може да е негативен.'),
  periodFrom: z.coerce.date(),
  periodTo: z.coerce.date(),
  status: z.enum(['planned', 'active', 'closed']).default('planned'),
  metaCampaignId: z.string().optional(),
});
export type CampaignCreateInput = z.infer<typeof campaignCreateSchema>;

export const campaignUpdateSchema = campaignCreateSchema.partial().omit({ clientId: true });
export type CampaignUpdateInput = z.infer<typeof campaignUpdateSchema>;

// ── Comments (@таг, D-9) ──
export const commentCreateSchema = z.object({
  body: z.string().min(1, 'Коментарот е задолжителен.'),
  mentions: z.array(z.string().uuid()).optional(),
});
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

// ── Notifications / automation (B1) ──
export const notificationPrefsSchema = z.object({ reminders: z.boolean() });
export type NotificationPrefsInput = z.infer<typeof notificationPrefsSchema>;

export const automationRuleCreateSchema = z.object({
  name: z.string().min(1),
  scope: z.enum(['global', 'client']).default('global'),
  clientId: z.string().uuid().optional(),
  trigger: z.record(z.string(), z.unknown()).default({}),
  conditions: z.array(z.unknown()).default([]),
  actions: z.array(z.unknown()).default([]),
  enabled: z.boolean().default(true),
});
export type AutomationRuleCreateInput = z.infer<typeof automationRuleCreateSchema>;

// ── Task list филтри (A3) ──
export const taskListQuerySchema = z.object({
  clientId: z.string().uuid().optional(),
  type: contentTypeSchema.optional(),
  status: z.enum(TASK_STATUSES).optional(),
  month: z
    .string()
    .regex(/^\d{4}-\d{2}$/)
    .optional(),
  assigneeId: z.string().uuid().optional(),
  q: z.string().optional(),
});
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
