/**
 * Модул 2 · Продажен CRM — state machine како ЕДИНСТВЕН извор на вистина
 * (CLAUDE.md И2, ист принцип како `workflow/transitions.ts`).
 *
 * Дизајн-извор: `GoDigital Task Manager Design/design_handoff_godigital_task_manager_v2/`
 * (`CRM_ADDENDUM.md` + `crmBuild()`/`CRM_FLOW`/`CRM_ST` во прототипот).
 *
 * Матрицата живее како ПОДАТОК, не како `if` гранки. Се увезува од: API `transitionLead`
 * сервис, CRM Board DnD валидација, и извозот за Админ/бот. Ниту еден друг модул не менува
 * `Lead.status`. `guards`/`effects` се ДЕКЛАРАТИВНИ токени; имплементациите со DB/ctx живеат
 * во `apps/api/src/services/crm`. Чистата „што недостасува" логика (`crmMissing`) е тука за да
 * ја делат guard-имплементацијата, тестовите и извозот.
 */

/** Pipeline статуси (11 чекори + 2 терминални). */
export const CRM_STATUSES = [
  'novLid',
  'analiza',
  'ponudaIzr',
  'ponudaOdob',
  'ponudaKlient',
  'sostanok',
  'dogIzr',
  'dogOdob',
  'dogKlient',
  'strategija',
  'aktivacija',
  'aktiviran',
  'izguben',
] as const;

export type CrmStatus = (typeof CRM_STATUSES)[number];

/** Редоследот на 11-те работни чекори (колони на таблата, лево→десно). */
export const CRM_FLOW: readonly CrmStatus[] = [
  'novLid',
  'analiza',
  'ponudaIzr',
  'ponudaOdob',
  'ponudaKlient',
  'sostanok',
  'dogIzr',
  'dogOdob',
  'dogKlient',
  'strategija',
  'aktivacija',
];

/** Терминални статуси. */
export const CRM_TERMINAL: readonly CrmStatus[] = ['aktiviran', 'izguben'];

/** Кој ја носи работната зона на статусот. `agent` = продажниот агент-сопственик на лидот. */
export type CrmOwner = 'agent' | 'dir';

/** Актер во CRM преод (вистински улоги). `agent` од CRM_ST → улога `sales`. */
export type CrmActor = 'sales' | 'dir';

export interface CrmStatusMeta {
  /** Македонска етикета (финална од прототипот). */
  label: string;
  /** Боја на статусот (постоечка палета — CLAUDE.md §8.3: никогаш сина за содржина статуси,
   *  но CRM ги користи истите статусни бои како прототипот). */
  color: string;
  /** Боја на текст на badge. */
  fg: string;
  /** Кој дејствува во овој статус (null = терминален). */
  owner: CrmOwner | null;
  /** Реден број на чекорот (за чекор-индикатор и споредба лево/десно). */
  step: number;
}

/** Метаподатоци по статус (етикети + бои + сопственик + чекор). Од `CRM_ST` во прототипот. */
export const CRM_STATUS_META: Record<CrmStatus, CrmStatusMeta> = {
  novLid: { label: 'Нов лид', color: '#8A93A0', fg: '#4B5563', owner: 'agent', step: 1 },
  analiza: { label: 'Анализа', color: '#0284C7', fg: '#0369A1', owner: 'agent', step: 2 },
  ponudaIzr: {
    label: 'Изработка на понуда',
    color: '#0866FF',
    fg: '#0052D9',
    owner: 'agent',
    step: 3,
  },
  ponudaOdob: {
    label: 'Одобрување понуда',
    color: '#7C3AED',
    fg: '#6D28D9',
    owner: 'dir',
    step: 4,
  },
  ponudaKlient: {
    label: 'Понуда кај клиент',
    color: '#D97706',
    fg: '#B45309',
    owner: 'agent',
    step: 5,
  },
  sostanok: { label: 'Состанок', color: '#0D9488', fg: '#0F766E', owner: 'agent', step: 6 },
  dogIzr: {
    label: 'Изработка на договор',
    color: '#0866FF',
    fg: '#0052D9',
    owner: 'agent',
    step: 7,
  },
  dogOdob: { label: 'Одобрување договор', color: '#7C3AED', fg: '#6D28D9', owner: 'dir', step: 8 },
  dogKlient: {
    label: 'Договор кај клиент',
    color: '#D97706',
    fg: '#B45309',
    owner: 'agent',
    step: 9,
  },
  strategija: {
    label: 'Стратегија + Content планер',
    color: '#DB2777',
    fg: '#BE185D',
    owner: 'agent',
    step: 10,
  },
  aktivacija: { label: 'Активација', color: '#16A34A', fg: '#15803D', owner: 'agent', step: 11 },
  aktiviran: { label: 'Активиран клиент', color: '#15803D', fg: '#166534', owner: null, step: 12 },
  izguben: { label: 'Изгубен лид', color: '#DC2626', fg: '#B91C1C', owner: null, step: 0 },
};

/** Причини за изгубен лид (за „Друго" белешката е задолжителна). */
export const LOSS_REASONS = ['Цена', 'Конкуренција', 'Лош тајминг', 'Друго'] as const;
export type LossReason = (typeof LOSS_REASONS)[number];

/** Извори на лид. */
export const CRM_SOURCES = ['Instagram', 'Facebook', 'TikTok', 'Препорака', 'Веб-страна'] as const;
export type CrmSource = (typeof CRM_SOURCES)[number];

/** Лид без промена ≥ N дена добива ознака и се појавува во филтерот. */
export const CRM_STALE_DAYS = 5;
/** Стратегијата е 90 дена → content планерот покрива 3 месеци. */
export const CRM_PLAN_MONTHS = 3;

/** Тип календар при активација (се преслика 1:1 во Client). */
export type CrmCalType = 'специфичен' | 'стандарден';

/**
 * Вид на CRM преод:
 *  - `forward`     — единствениот нареден чекор; дозволен преку Board DnD (guard-от се извршува).
 *  - `return`      — враќање назад со задолжителен коментар (само од панел, не Board).
 *  - `lose`        — означи изгубен (само од чекор 5 и 9).
 *  - `reactivate`  — реактивација на изгубен лид.
 */
export type CrmTransitionKind = 'forward' | 'return' | 'lose' | 'reactivate';

export interface CrmTransitionRule {
  from: CrmStatus;
  to: CrmStatus;
  actor: CrmActor;
  guards: string[];
  effects: string[];
  kind: CrmTransitionKind;
  /** Бара внес во панелот (коментар/причина) → НЕ е дозволен преку Board DnD. */
  requiresInput: boolean;
  note?: string;
}

/**
 * CRM преоди (Pipeline). Секој ред е ПОДАТОК.
 * Guards (токени, имплементација во API + чист `crmMissing` тука):
 *   G_ROLE · G_ANALYSIS · G_OFFER_VERSION · G_MEETING · G_PKG_FIELDS · G_CONTRACT_VERSION
 *   G_SIGNED · G_STRATEGY_PLAN · G_COMMENT · G_LOSS_REASON
 * Effects (токени):
 *   E_NOTIFY(dir|agent) · E_OFFER_RETURN · E_OFFER_CLIENT_RETURN · E_CONTRACT_RETURN
 *   E_CONTRACT_CLIENT_RETURN · E_RESET_MEETING · E_SET_DEFAULT_TEAM · E_ACTIVATE · E_MARK_LOST
 *   E_REACTIVATE
 */
export const CRM_TRANSITIONS: readonly CrmTransitionRule[] = [
  // 1 → 2
  {
    from: 'novLid',
    to: 'analiza',
    actor: 'sales',
    guards: ['G_ROLE'],
    effects: [],
    kind: 'forward',
    requiresInput: false,
    note: 'Започна анализа.',
  },
  // 2 → 3
  {
    from: 'analiza',
    to: 'ponudaIzr',
    actor: 'sales',
    guards: ['G_ROLE', 'G_ANALYSIS'],
    effects: [],
    kind: 'forward',
    requiresInput: false,
    note: 'Анализата е комплетна.',
  },
  // 3 → 4
  {
    from: 'ponudaIzr',
    to: 'ponudaOdob',
    actor: 'sales',
    guards: ['G_ROLE', 'G_OFFER_VERSION'],
    effects: ['E_NOTIFY(dir)'],
    kind: 'forward',
    requiresInput: false,
    note: 'Понуда vN пратена на одобрување.',
  },
  // 4 → 5 (одобри)
  {
    from: 'ponudaOdob',
    to: 'ponudaKlient',
    actor: 'dir',
    guards: ['G_ROLE'],
    effects: ['E_NOTIFY(agent)'],
    kind: 'forward',
    requiresInput: false,
    note: 'Директорот ја одобри понудата vN.',
  },
  // 4 → 3 (врати со коментар)
  {
    from: 'ponudaOdob',
    to: 'ponudaIzr',
    actor: 'dir',
    guards: ['G_ROLE', 'G_COMMENT'],
    effects: ['E_OFFER_RETURN', 'E_NOTIFY(agent)'],
    kind: 'return',
    requiresInput: true,
    note: 'Директорот врати понуда vN со коментар.',
  },
  // 5 → 6 (клиент прифати)
  {
    from: 'ponudaKlient',
    to: 'sostanok',
    actor: 'sales',
    guards: ['G_ROLE'],
    effects: [],
    kind: 'forward',
    requiresInput: false,
    note: 'Клиентот ја прифати понудата.',
  },
  // 5 → 3 (клиент бара измени)
  {
    from: 'ponudaKlient',
    to: 'ponudaIzr',
    actor: 'sales',
    guards: ['G_ROLE', 'G_COMMENT'],
    effects: ['E_OFFER_CLIENT_RETURN'],
    kind: 'return',
    requiresInput: true,
    note: 'Клиентот бара измени на понуда vN.',
  },
  // 5 → изгубен
  {
    from: 'ponudaKlient',
    to: 'izguben',
    actor: 'sales',
    guards: ['G_ROLE', 'G_LOSS_REASON'],
    effects: ['E_MARK_LOST'],
    kind: 'lose',
    requiresInput: true,
    note: 'Изгубен лид.',
  },
  // 6 → 7
  {
    from: 'sostanok',
    to: 'dogIzr',
    actor: 'sales',
    guards: ['G_ROLE', 'G_MEETING'],
    effects: [],
    kind: 'forward',
    requiresInput: false,
    note: 'Состанокот е затворен.',
  },
  // 7 → 8
  {
    from: 'dogIzr',
    to: 'dogOdob',
    actor: 'sales',
    guards: ['G_ROLE', 'G_PKG_FIELDS', 'G_CONTRACT_VERSION'],
    effects: ['E_NOTIFY(dir)'],
    kind: 'forward',
    requiresInput: false,
    note: 'Договор vN пратен на одобрување.',
  },
  // 8 → 9 (одобри)
  {
    from: 'dogOdob',
    to: 'dogKlient',
    actor: 'dir',
    guards: ['G_ROLE'],
    effects: ['E_NOTIFY(agent)'],
    kind: 'forward',
    requiresInput: false,
    note: 'Директорот го одобри договорот vN.',
  },
  // 8 → 7 (врати со коментар)
  {
    from: 'dogOdob',
    to: 'dogIzr',
    actor: 'dir',
    guards: ['G_ROLE', 'G_COMMENT'],
    effects: ['E_CONTRACT_RETURN', 'E_NOTIFY(agent)'],
    kind: 'return',
    requiresInput: true,
    note: 'Директорот врати договор vN со коментар.',
  },
  // 9 → 10 (потпишан)
  {
    from: 'dogKlient',
    to: 'strategija',
    actor: 'sales',
    guards: ['G_ROLE', 'G_SIGNED'],
    effects: [],
    kind: 'forward',
    requiresInput: false,
    note: 'Договорот е потпишан.',
  },
  // 9 → 7 (клиент бара измени)
  {
    from: 'dogKlient',
    to: 'dogIzr',
    actor: 'sales',
    guards: ['G_ROLE', 'G_COMMENT'],
    effects: ['E_CONTRACT_CLIENT_RETURN'],
    kind: 'return',
    requiresInput: true,
    note: 'Клиентот бара измени на договор vN.',
  },
  // 9 → изгубен
  {
    from: 'dogKlient',
    to: 'izguben',
    actor: 'sales',
    guards: ['G_ROLE', 'G_LOSS_REASON'],
    effects: ['E_MARK_LOST'],
    kind: 'lose',
    requiresInput: true,
    note: 'Изгубен лид.',
  },
  // 10 → 11
  {
    from: 'strategija',
    to: 'aktivacija',
    actor: 'sales',
    guards: ['G_ROLE', 'G_STRATEGY_PLAN'],
    effects: ['E_SET_DEFAULT_TEAM'],
    kind: 'forward',
    requiresInput: false,
    note: 'Стратегијата и планерот се финализирани.',
  },
  // 11 → активиран
  {
    from: 'aktivacija',
    to: 'aktiviran',
    actor: 'sales',
    guards: ['G_ROLE', 'G_STRATEGY_PLAN'],
    effects: ['E_ACTIVATE'],
    kind: 'forward',
    requiresInput: false,
    note: 'Активираше клиент во Task Manager.',
  },
  // реактивација од изгубен → назад во изработка (понуда или договор)
  {
    from: 'izguben',
    to: 'ponudaIzr',
    actor: 'sales',
    guards: ['G_ROLE'],
    effects: ['E_REACTIVATE'],
    kind: 'reactivate',
    requiresInput: false,
    note: 'Лидот е реактивиран.',
  },
  {
    from: 'izguben',
    to: 'dogIzr',
    actor: 'sales',
    guards: ['G_ROLE'],
    effects: ['E_REACTIVATE'],
    kind: 'reactivate',
    requiresInput: false,
    note: 'Лидот е реактивиран.',
  },
];

/** Најди CRM правило за преод. */
export function findCrmTransition(from: CrmStatus, to: CrmStatus): CrmTransitionRule | undefined {
  return CRM_TRANSITIONS.find((r) => r.from === from && r.to === to);
}

/** Единствениот нареден (forward) чекор од даден статус, ако постои. */
export function crmForwardTarget(from: CrmStatus): CrmStatus | undefined {
  return CRM_TRANSITIONS.find((r) => r.from === from && r.kind === 'forward')?.to;
}

/** Сите дозволени целни статуси од даден статус (за UI feedback; серверот пак проверува). */
export function allowedCrmTargets(from: CrmStatus): CrmStatus[] {
  return CRM_TRANSITIONS.filter((r) => r.from === from).map((r) => r.to);
}

/**
 * Дали преодот е дозволен преку CRM Board drag-and-drop.
 * Правило (ADDENDUM): влечење само кон СЛЕДНИОТ дозволен чекор (`forward`); guard-от пак се
 * извршува и ако нешто недостасува, преодот паѓа со порака. Враќање/губење само од панел.
 */
export function isCrmBoardDraggable(from: CrmStatus, to: CrmStatus): boolean {
  const rule = findCrmTransition(from, to);
  return rule !== undefined && rule.kind === 'forward';
}

/** Реден чекор за прикажување — за изгубен користи го чекорот од кој паднал. */
export function crmStage(status: CrmStatus, lostFrom?: CrmStatus | null): number {
  if (status === 'izguben' && lostFrom) return CRM_STATUS_META[lostFrom].step;
  return CRM_STATUS_META[status].step;
}

/** Дали лидот е застарен (без промена ≥ CRM_STALE_DAYS, и не е терминален). */
export function crmIsStale(status: CrmStatus, staleDays: number): boolean {
  return staleDays >= CRM_STALE_DAYS && !CRM_TERMINAL.includes(status);
}

// ─────────────────────────── Чиста „што недостасува" логика ───────────────────────────
// Огледало на `crmMissing`/`crmPkgMissing`/`crmPlanOk` од прототипот. Ги дели guard-от во API,
// тестовите и извозот за Админ/бот. Работи на чист поглед на лидот (без Prisma).

export interface CrmDocVersion {
  /** Врата од директор (ret) — бара нова верзија. */
  returned: boolean;
  /** Клиентот бара измени (clientRet) — бара нова верзија. */
  clientReturned: boolean;
}

export interface CrmMeetingView {
  date: string;
  time: string;
  held: boolean;
  hasAudio: boolean;
  hasNotes: boolean;
}

export interface CrmPkgView {
  videos: number;
  graphics: number;
  meta: boolean;
  /** Стартен месец `YYYY-MM`. */
  start: string;
  /** Должина на договор во месеци. */
  months: number;
  calType: CrmCalType;
}

export interface CrmLeadView {
  status: CrmStatus;
  hasAnalysis: boolean;
  offers: CrmDocVersion[];
  contracts: CrmDocVersion[];
  meeting: CrmMeetingView | null;
  pkg: CrmPkgView;
  hasSigned: boolean;
  hasStrategy: boolean;
  hasFable: boolean;
  /** Пресметан број видео/графика датуми во планерот по месец `YYYY-MM`. */
  planCountsByMonth: Record<string, { v: number; g: number }>;
}

/** Последната верзија постои и не е вратена (ниту од директор, ниту од клиент). */
export function crmLastVersionOk(arr: CrmDocVersion[]): boolean {
  const last = arr[arr.length - 1];
  if (!last) return false;
  return !last.returned && !last.clientReturned;
}

/** `YYYY-MM` месеци што ги покрива планерот (CRM_PLAN_MONTHS почнувајќи од стартот). */
export function crmPlanKeys(start: string): string[] {
  const parts = start.split('-');
  const y = Number(parts[0]); // parts[0] секогаш постои (split враќа ≥1 елемент)
  const m = Number(parts[1] ?? 1); // недостасува месец → почни од јануари
  const out: string[] = [];
  for (let i = 0; i < CRM_PLAN_MONTHS; i++) {
    const idx = m - 1 + i;
    const year = y + Math.floor(idx / 12);
    const month = (idx % 12) + 1;
    out.push(`${year}-${String(month).padStart(2, '0')}`);
  }
  return out;
}

/** Дали бројот на видео/графика датуми во месецот се совпаѓа со пакетот. */
export function crmPlanMonthOk(
  counts: { v: number; g: number } | undefined,
  pkg: CrmPkgView,
): boolean {
  const c = counts ?? { v: 0, g: 0 };
  return c.v === pkg.videos && c.g === pkg.graphics;
}

/** Полиња на пакетот што недостасуваат (чекор 7). */
export function crmPkgMissing(pkg: CrmPkgView): string[] {
  const out: string[] = [];
  if (pkg.videos + pkg.graphics === 0) out.push('број видеа/графики');
  if (!pkg.start) out.push('старт датум');
  if (!pkg.months) out.push('должина на договор');
  return out;
}

/**
 * Што недостасува за да се напушти тековниот статус (задолжителен внес).
 * Враќа македонски етикети — истите копи како во прототипот; guard пораката се гради од нив.
 */
export function crmMissing(lead: CrmLeadView): string[] {
  const out: string[] = [];
  switch (lead.status) {
    case 'analiza':
      if (!lead.hasAnalysis) out.push('документ за анализа');
      break;
    case 'ponudaIzr':
      if (!crmLastVersionOk(lead.offers)) out.push(`понуда v${lead.offers.length + 1}`);
      break;
    case 'sostanok': {
      const m = lead.meeting;
      if (!m || !m.date || !m.time) out.push('датум и час на состанок');
      else if (!m.held) out.push('потврда дека состанокот е одржан');
      if (!(m?.hasAudio || m?.hasNotes)) out.push('аудио или заклучоци');
      break;
    }
    case 'dogIzr':
      out.push(...crmPkgMissing(lead.pkg));
      if (!crmLastVersionOk(lead.contracts)) out.push(`договор v${lead.contracts.length + 1}`);
      break;
    case 'dogKlient':
      if (!lead.hasSigned) out.push('потпишан договор');
      break;
    case 'strategija':
    case 'aktivacija': {
      if (!lead.hasStrategy) out.push('стратегија за 90 дена');
      if (!lead.hasFable) out.push('Fable 5 фајл');
      if (lead.pkg.calType === 'специфичен') {
        const bad = crmPlanKeys(lead.pkg.start).filter(
          (k) => !crmPlanMonthOk(lead.planCountsByMonth[k], lead.pkg),
        );
        if (bad.length) out.push(`датуми во планерот (${bad.join(', ')})`);
      }
      break;
    }
  }
  return out;
}

/**
 * Стандарден тим при активација (кои улоги се потребни).
 * АМ секогаш · Режисер ако видеа>0 · Гр. креатор ако графики>0 · Аналитичар ако Meta Ads.
 * Само Директорот го менува, и тоа само во чекор 11 (ADDENDUM §Стандарден тим).
 */
export function crmDefaultTeamRoles(pkg: Pick<CrmPkgView, 'videos' | 'graphics' | 'meta'>): {
  am: boolean;
  rez: boolean;
  krea: boolean;
  ana: boolean;
} {
  return {
    am: true,
    rez: pkg.videos > 0,
    krea: pkg.graphics > 0,
    ana: pkg.meta,
  };
}

/** При реактивација од изгубен → каде се враќа (според чекорот од кој паднал). */
export function crmReactivateTarget(lostFrom: CrmStatus): CrmStatus {
  return lostFrom === 'ponudaKlient' ? 'ponudaIzr' : 'dogIzr';
}
