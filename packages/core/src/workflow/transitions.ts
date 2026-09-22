import type { Actor, ContentType } from '../roles.js';
import type { GroupStatus, TaskStatus } from '../statuses.js';

/**
 * State machine — единствен извор на вистина (PRD §4.3, CLAUDE.md И2).
 * Матрицата живее како ПОДАТОК, не како `if` гранки. Се увезува од: API transition сервис,
 * Board DnD валидација, Rule Builder и извозот за ботот. Ниту еден друг модул не менува `status`.
 *
 * `guards`/`effects` се ДЕКЛАРАТИВНИ токени (стрингови). Нивните имплементации (со DB/ctx)
 * живеат во `apps/api/src/services/workflow`. Токените точно ги следат PRD §4.3 табелите.
 * `requiresInput: true` → преодот бара внес во панелот и НЕ е дозволен преку Board DnD (PRD §4.3).
 */
export interface TransitionRule {
  from: TaskStatus;
  to: TaskStatus;
  contentType: ContentType | 'both';
  actor: Actor;
  guards: string[];
  effects: string[];
  requiresInput: boolean;
  note?: string;
}

export interface GroupTransitionRule {
  from: GroupStatus;
  to: GroupStatus;
  contentType: ContentType;
  actor: Actor;
  guards: string[];
  effects: string[];
  note?: string;
}

/** Преоди на таск — видео + графика (PRD §4.3). */
export const TASK_TRANSITIONS: readonly TransitionRule[] = [
  // ── видео ──
  {
    from: 'mrtov',
    to: 'cekaSnimanje',
    contentType: 'video',
    actor: 'system',
    guards: ['G_CAPA_IN_SNIMANJE', 'G_SCENARIO_BOUND'],
    effects: ['E_BIND_SCENARIOS'],
    requiresInput: false,
    note: 'Активација при scenKajKlient→snimanje (D-1, D-2: датумот останува).',
  },
  {
    from: 'cekaSnimanje',
    to: 'chekaRezija',
    contentType: 'video',
    actor: 'system',
    guards: ['G_CAPA_CLOSED'],
    effects: ['E_ASSIGN(rez)'],
    requiresInput: false,
    note: 'При прикачување суров материјал капата→zatvoren, децата→chekaRezija.',
  },
  {
    from: 'chekaRezija',
    to: 'montaza',
    contentType: 'video',
    actor: 'rez',
    guards: ['G_ASSIGNEE_REQUIRED(mon)', 'G_NOT_SELF_APPROVAL'],
    effects: ['E_ASSIGN(mon)', 'E_NOTIFY(nov_task,mon)'],
    requiresInput: true,
  },
  {
    from: 'montaza',
    to: 'vnatresno',
    contentType: 'video',
    actor: 'mon',
    guards: ['G_FILE(final,1)'],
    effects: ['E_ASSIGN(rez)'],
    requiresInput: true,
  },
  {
    from: 'vnatresno',
    to: 'montaza',
    contentType: 'video',
    actor: 'rez',
    guards: ['G_COMMENT'],
    effects: ['E_VERSION_BUMP', 'E_REVISION(internal)', 'E_ASSIGN(mon)', 'E_NOTIFY(vraten,mon)'],
    requiresInput: true,
    note: 'Враќање — бара коментар, нова верзија. Одбиено од Board.',
  },
  {
    from: 'vnatresno',
    to: 'kajKlient',
    contentType: 'video',
    actor: 'rez',
    guards: [],
    effects: ['E_APPROVAL(internal,approved)'],
    requiresInput: false,
  },
  {
    from: 'kajKlient',
    to: 'montaza',
    contentType: 'video',
    actor: 'rez',
    guards: ['G_COMMENT'],
    effects: [
      'E_APPROVAL(client,return)',
      'E_VERSION_BUMP',
      'E_REVISION(client)',
      'E_ASSIGN(mon)',
      'E_ALARM(11)?', // ако 3-то враќање од клиент
    ],
    requiresInput: true,
  },
  {
    from: 'kajKlient',
    to: 'zaObjavuvanje',
    contentType: 'video',
    actor: 'rez',
    guards: ['G_CLIENT_OUTCOME(approved|approvedWithChanges)', 'G_COMMENT_IF_CHANGES'],
    effects: ['E_APPROVAL(client)', 'E_ASSIGN(am)'],
    requiresInput: true,
  },
  // ── графика ──
  {
    from: 'mrtov',
    to: 'brifing',
    contentType: 'graphic',
    actor: 'krea',
    guards: [],
    effects: ['E_ASSIGN(krea)', 'E_CLOSE_GROUP_IF_FIRST'],
    requiresInput: false,
    note: 'Отворање на слот или bulk „Активирај ги сите" (D-3). Првиот затвора капа.',
  },
  {
    from: 'brifing',
    to: 'dizajn',
    contentType: 'graphic',
    actor: 'krea',
    guards: ['G_TEXT(brief,50)', 'G_ASSIGNEE_REQUIRED(diz)', 'G_NOT_SELF_APPROVAL'],
    effects: ['E_ASSIGN(diz)', 'E_NOTIFY(nov_task,diz)'],
    requiresInput: true,
  },
  {
    from: 'dizajn',
    to: 'vnatresno',
    contentType: 'graphic',
    actor: 'diz',
    guards: ['G_FILE(graphic,1)'],
    effects: ['E_ASSIGN(krea)'],
    requiresInput: true,
  },
  {
    from: 'vnatresno',
    to: 'dizajn',
    contentType: 'graphic',
    actor: 'krea',
    guards: ['G_COMMENT'],
    effects: ['E_VERSION_BUMP', 'E_REVISION(internal)', 'E_ASSIGN(diz)', 'E_NOTIFY(vraten,diz)'],
    requiresInput: true,
  },
  {
    from: 'vnatresno',
    to: 'kajKlient',
    contentType: 'graphic',
    actor: 'krea',
    guards: [],
    effects: ['E_APPROVAL(internal,approved)'],
    requiresInput: false,
  },
  {
    from: 'kajKlient',
    to: 'dizajn',
    contentType: 'graphic',
    actor: 'krea',
    guards: ['G_COMMENT'],
    effects: [
      'E_APPROVAL(client,return)',
      'E_VERSION_BUMP',
      'E_REVISION(client)',
      'E_ASSIGN(diz)',
      'E_ALARM(11)?',
    ],
    requiresInput: true,
  },
  {
    from: 'kajKlient',
    to: 'zaObjavuvanje',
    contentType: 'graphic',
    actor: 'krea',
    guards: ['G_CLIENT_OUTCOME(approved|approvedWithChanges)', 'G_COMMENT_IF_CHANGES'],
    effects: ['E_APPROVAL(client)', 'E_ASSIGN(am)'],
    requiresInput: true,
  },
  // ── заеднички (двата типа) ──
  {
    from: 'zaObjavuvanje',
    to: 'objaveno',
    contentType: 'both',
    actor: 'am',
    guards: ['G_TEXT(copy,1)', 'G_PUBLICATION'],
    effects: ['E_SCHEDULE_METRICS', 'E_AUTO_NEXT(analitika)?'], // само ако usesMetaAds (D-6)
    requiresInput: true,
  },
  {
    from: 'analitika',
    to: 'zavrseno',
    contentType: 'both',
    actor: 'ana',
    guards: ['G_DECISION'],
    effects: [],
    requiresInput: true,
  },
];

/** Преоди на капа таск — видео + графика (PRD §4.3). */
export const GROUP_TRANSITIONS: readonly GroupTransitionRule[] = [
  {
    from: 'podgotovka',
    to: 'scenarija',
    contentType: 'video',
    actor: 'rez',
    guards: ['G_CAPA_FIELDS'],
    effects: ['E_ASSIGN(scen)', 'E_NOTIFY(nov_task,scen)'],
  },
  {
    from: 'scenarija',
    to: 'scenKajKlient',
    contentType: 'video',
    actor: 'scen',
    guards: ['G_FILE(scenarioDoc,1)', 'G_SCENARIOS_SPLIT'],
    effects: ['E_ASSIGN(rez)', 'E_NOTIFY'],
  },
  {
    from: 'scenKajKlient',
    to: 'scenarija',
    contentType: 'video',
    actor: 'rez',
    guards: ['G_COMMENT'],
    effects: ['E_VERSION_BUMP(document)', 'E_REVISION(client)', 'E_ASSIGN(scen)'],
    note: 'Враќање: 0 одобрени сценарија.',
  },
  {
    from: 'scenKajKlient',
    to: 'snimanje',
    contentType: 'video',
    actor: 'rez',
    guards: ['G_SCENARIO_OUTCOMES', 'G_AT_LEAST_ONE_APPROVED'],
    effects: [
      'E_APPROVAL(client,perScenario)',
      'E_BIND_SCENARIOS',
      'E_ACTIVATE_CHILDREN(cekaSnimanje)',
      'E_CREATE_EXTRA_SLOTS?',
      'E_ALARM(9)?',
      'E_ASSIGN(kam)',
    ],
  },
  {
    from: 'snimanje',
    to: 'zatvoren',
    contentType: 'video',
    actor: 'system',
    guards: ['G_FILE(raw,1)'],
    effects: [
      'E_CLOSE_GROUP',
      'E_ACTIVATE_CHILDREN(chekaRezija)',
      'E_ASSIGN(rez)',
      'E_STORAGE_TIMER',
    ],
  },
  {
    from: 'gPodgotovka',
    to: 'zatvoren',
    contentType: 'graphic',
    actor: 'system',
    guards: ['G_FIRST_CHILD_IN_BRIFING'],
    effects: ['E_CLOSE_GROUP'],
    note: 'Заедничките фајлови остануваат уредливи до крај на месецот.',
  },
];

/** Најди правило за преод на таск. */
export function findTaskTransition(
  from: TaskStatus,
  to: TaskStatus,
  contentType: ContentType,
): TransitionRule | undefined {
  return TASK_TRANSITIONS.find(
    (r) =>
      r.from === from && r.to === to && (r.contentType === 'both' || r.contentType === contentType),
  );
}

/** Дозволени целни статуси од даден статус (за Board/UI feedback; серверот пак проверува). */
export function allowedTaskTargets(from: TaskStatus, contentType: ContentType): TaskStatus[] {
  return TASK_TRANSITIONS.filter(
    (r) => r.from === from && (r.contentType === 'both' || r.contentType === contentType),
  ).map((r) => r.to);
}

/** Дали преодот е дозволен преку Board drag-and-drop (без input-guards) (PRD §4.3). */
export function isBoardDraggable(
  from: TaskStatus,
  to: TaskStatus,
  contentType: ContentType,
): boolean {
  const rule = findTaskTransition(from, to, contentType);
  return rule !== undefined && !rule.requiresInput;
}

export function findGroupTransition(
  from: GroupStatus,
  to: GroupStatus,
  contentType: ContentType,
): GroupTransitionRule | undefined {
  return GROUP_TRANSITIONS.find(
    (r) => r.from === from && r.to === to && r.contentType === contentType,
  );
}
