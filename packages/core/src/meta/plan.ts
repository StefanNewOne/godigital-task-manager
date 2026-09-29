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
