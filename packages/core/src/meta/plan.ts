/**
 * Модул 3 · Мета — state machine на план за промена (META_TECH_SPEC §12).
 * Матрица како ПОДАТОК (ист принцип како task/capa/CRM). Планот НЕ извршува ништо —
 * го потврдува sync-от кога човекот ќе ја направи промената во Ads Manager.
 *
 *   pending ──approve──▶ approved ──mark-done──▶ syncing ──match──▶ done
 *      │                    │                       └──no match 24h──▶ mismatch
 *      ├──reject(note)──▶ rejected
 *      └──withdraw(ana)──▶ withdrawn
 *   dir креира → директно approved
 */

import type { OpCode } from './operations.js';

export const PLAN_STATUSES = [
  'pending',
  'approved',
  'syncing',
  'done',
  'rejected',
  'mismatch',
  'withdrawn',
] as const;

export type PlanStatus = (typeof PLAN_STATUSES)[number];

/** Терминални состојби (нема натамошен преод). */
export const PLAN_TERMINAL: readonly PlanStatus[] = ['done', 'rejected', 'withdrawn', 'mismatch'];

/** Кој го иницира преодот. `system` = sync (потврда/несовпаѓање). */
export type PlanActor = 'dir' | 'ana' | 'system';

export interface PlanTransition {
  from: PlanStatus;
  to: PlanStatus;
  actor: PlanActor;
  /** Бара белешка (одбивање). */
  requiresNote: boolean;
  /** Само сопственикот (ана што го создал) — за withdraw. */
  ownerOnly: boolean;
  note?: string;
}

export const PLAN_TRANSITIONS: readonly PlanTransition[] = [
  { from: 'pending', to: 'approved', actor: 'dir', requiresNote: false, ownerOnly: false },
  {
    from: 'pending',
    to: 'rejected',
    actor: 'dir',
    requiresNote: true,
    ownerOnly: false,
    note: 'Одбивање бара белешка.',
  },
  {
    from: 'pending',
    to: 'withdrawn',
    actor: 'ana',
    requiresNote: false,
    ownerOnly: true,
    note: 'Аналитичар повлекува само свој pending план.',
  },
  {
    from: 'approved',
    to: 'syncing',
    actor: 'dir',
    requiresNote: false,
    ownerOnly: false,
    note: '„Направено во Ads Manager".',
  },
  {
    from: 'syncing',
    to: 'done',
    actor: 'system',
    requiresNote: false,
    ownerOnly: false,
    note: 'Sync ја потврди промената.',
  },
  {
    from: 'syncing',
    to: 'mismatch',
    actor: 'system',
    requiresNote: false,
    ownerOnly: false,
    note: 'Нема совпаѓање 24 часа → алерт до Директор.',
  },
];

export function findPlanTransition(from: PlanStatus, to: PlanStatus): PlanTransition | undefined {
  return PLAN_TRANSITIONS.find((t) => t.from === from && t.to === to);
}

export function allowedPlanTargets(from: PlanStatus): PlanStatus[] {
  return PLAN_TRANSITIONS.filter((t) => t.from === from).map((t) => t.to);
}

export function isPlanTerminal(status: PlanStatus): boolean {
  return PLAN_TERMINAL.includes(status);
}

// ─────────────────────────── Preview + верификација (§12) ───────────────────────────

/**
 * Операции чии `after` вредности sync-от може машински да ги спореди со огледалото
 * (status/буџет/краен датум/име). Само нив ги потврдува/означува mismatch по 24 ч; за
 * креативните операции (нова кампања/ad set/видео…) нема детерминистичка споредба.
 */
export const OP_VERIFIABLE: ReadonlySet<OpCode> = new Set<OpCode>(['O1', 'O2', 'O9', 'O11']);

export function isPlanVerifiable(op: OpCode): boolean {
  return OP_VERIFIABLE.has(op);
}

export interface PlanPreviewInput {
  op: OpCode;
  /** Внес од модалот (нов буџет, ново име, статус, краен датум…). */
  params?: Record<string, unknown>;
  /** Тековни вредности од огледалото на целниот објект. */
  before?: Record<string, unknown>;
  /** За буџет/именување предупредувања. */
  client?: { metaMaxDailyBudget?: number | null; metaNamingConvention?: string | null };
  /** Дали целниот ad set/кампања сè уште учи (learning). */
  learning?: boolean;
}

export interface PlanPreview {
  consequences: string[];
  warnings: string[];
  /** Очекувана вредност по промената — sync ја споредува со огледалото. */
  after: Record<string, unknown> | null;
}

/**
 * Детерминистички ги гради последиците, предупредувањата и очекуваната `after` вредност
 * за план. Чиста функција (без I/O) — сервисот ги дава `before`/`client` од базата.
 */
export function buildPlanPreview(input: PlanPreviewInput): PlanPreview {
  const { op, params = {}, before = {}, client = {}, learning = false } = input;
  const consequences: string[] = [];
  const warnings: string[] = [];
  let after: Record<string, unknown> | null = null;

  switch (op) {
    case 'O1': {
      const activate = params.status === 'ACTIVE' || params.active === true;
      after = { status: activate ? 'ACTIVE' : 'PAUSED' };
      consequences.push(activate ? 'Објектот се активира.' : 'Објектот се паузира.');
      if (activate && before.pausedExternally === true) {
        warnings.push('Активирање на објект паузиран однадвор (pausedExternally).');
      }
      break;
    }
    case 'O2': {
      const amount = Number(params.amount);
      const current = Number(before.dailyBudget);
      after = { dailyBudget: amount };
      consequences.push(`Дневен буџет → €${amount}.`);
      if (Number.isFinite(current) && current > 0) {
        const delta = Math.abs(amount - current) / current;
        if (delta > 0.2) {
          warnings.push(
            `Промена > 20% (од €${current} на €${amount}) — може да рестартира learning.`,
          );
        }
      }
      if (client.metaMaxDailyBudget != null && amount > client.metaMaxDailyBudget) {
        warnings.push(`Над дозволениот максимум (€${client.metaMaxDailyBudget}).`);
      }
      break;
    }
    case 'O9': {
      after = { stopTime: params.endDate ?? params.stopTime ?? null };
      consequences.push('Се поставува краен датум на кампањата.');
      break;
    }
    case 'O11': {
      const name = String(params.name ?? '');
      after = { name };
      consequences.push(`Ново име: „${name}".`);
      if (client.metaNamingConvention && !name.includes(client.metaNamingConvention)) {
        warnings.push(`Името не ја следи конвенцијата „${client.metaNamingConvention}".`);
      }
      break;
    }
    case 'O6':
    case 'O7': {
      consequences.push(op === 'O6' ? 'Се копира ad set.' : 'Се создава нов ad set.');
      if (learning) warnings.push('Ќе стартира нова learning фаза + ќе се дели буџетот.');
      break;
    }
    case 'O4': {
      consequences.push('Се прави реклама од органски пост.');
      if (before.mixedCta === true) warnings.push('Различни CTA во ad set-от.');
      break;
    }
    case 'O5':
      consequences.push('Се додава ново видео во ad set.');
      break;
    case 'O3':
      consequences.push('Се закажува буџет.');
      break;
    case 'O8':
      consequences.push('Нова кампања (Auction · CBO · Highest volume · без Audience Network).');
      break;
    case 'O10':
      consequences.push('Се менува CTA/линк/шаблон на рекламата.');
      break;
    case 'O12':
      consequences.push('Се дуплира кампањата.');
      break;
  }

  return { consequences, warnings, after };
}
