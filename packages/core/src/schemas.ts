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

// ── Comments (@таг, D-9) ──
export const commentCreateSchema = z.object({
  body: z.string().min(1, 'Коментарот е задолжителен.'),
  mentions: z.array(z.string().uuid()).optional(),
});
export type CommentCreateInput = z.infer<typeof commentCreateSchema>;

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
