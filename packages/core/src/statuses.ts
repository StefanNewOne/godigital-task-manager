import type { ContentType, Role } from './roles.js';

/**
 * Статуси на таск — единствена табела (PRD §4.1).
 * Клучевите се DB enum, API вредности и UI клучеви. Етикетите се единственото
 * што корисникот гледа. Бојата НЕ се чува тука — таа е UI токен (packages/ui).
 */
export const TASK_STATUSES = [
  'mrtov',
  'cekaSnimanje',
  'brifing',
  'dizajn',
  'chekaRezija',
  'montaza',
  'vnatresno',
  'kajKlient',
  'zaObjavuvanje',
  'objaveno',
  'analitika',
  'zavrseno',
  'pauza',
  'otkazano',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

/** Редослед за колони/групирање (PRD §4.1 `ALL_STATUSES`). */
export const ALL_STATUSES: readonly TaskStatus[] = TASK_STATUSES;

/** Статуси на капа таск (PRD §4.2). Графиката користи само gPodgotovka → zatvoren. */
export const GROUP_STATUSES = [
  'podgotovka',
  'scenarija',
  'scenKajKlient',
  'snimanje',
  'gPodgotovka',
  'zatvoren',
] as const;

export type GroupStatus = (typeof GROUP_STATUSES)[number];

/**
 * Метаподатоци по статус на таск.
 * `owner`: улогата што го носи статусот. `null` = никој (мирување/терминал/резервиран).
 *   За vnatresno/kajKlient сопственикот зависи од тип → види `ownerOf()`.
 * `contentTypes`: за кои типови содржина важи статусот.
 */
interface TaskStatusMeta {
  label: string;
  owner: Role | null;
  contentTypes: readonly ContentType[];
}

export const TASK_STATUS_META: Record<TaskStatus, TaskStatusMeta> = {
  mrtov: { label: 'Резервиран слот', owner: null, contentTypes: ['video', 'graphic'] },
  cekaSnimanje: { label: 'Чека снимање', owner: 'kam', contentTypes: ['video'] },
  brifing: { label: 'Брифинг', owner: 'krea', contentTypes: ['graphic'] },
  dizajn: { label: 'Дизајн', owner: 'diz', contentTypes: ['graphic'] },
  chekaRezija: { label: 'Чека режија', owner: 'rez', contentTypes: ['video'] },
  montaza: { label: 'Монтажа', owner: 'mon', contentTypes: ['video'] },
  // vnatresno/kajKlient: owner зависи од тип (video→rez, graphic→krea) — види ownerOf().
  vnatresno: { label: 'Внатрешно одобрување', owner: null, contentTypes: ['video', 'graphic'] },
  kajKlient: { label: 'Кај клиент', owner: null, contentTypes: ['video', 'graphic'] },
  zaObjavuvanje: { label: 'За објавување', owner: 'am', contentTypes: ['video', 'graphic'] },
  objaveno: { label: 'Објавено', owner: null, contentTypes: ['video', 'graphic'] },
  analitika: { label: 'Аналитика', owner: 'ana', contentTypes: ['video', 'graphic'] },
  zavrseno: { label: 'Завршено', owner: null, contentTypes: ['video', 'graphic'] },
  pauza: { label: 'Пауза', owner: null, contentTypes: ['video', 'graphic'] },
  otkazano: { label: 'Откажано', owner: null, contentTypes: ['video', 'graphic'] },
};

export const GROUP_STATUS_META: Record<GroupStatus, { label: string; owner: Role | 'system' }> = {
  podgotovka: { label: 'Подготовка', owner: 'rez' },
  scenarija: { label: 'Сценарија', owner: 'scen' },
  scenKajKlient: { label: 'Сценарија кај клиент', owner: 'rez' },
  snimanje: { label: 'Снимање', owner: 'kam' },
  gPodgotovka: { label: 'Подготовка', owner: 'krea' },
  zatvoren: { label: 'Затворен', owner: 'system' },
};

/**
 * Сопственик на статус, разрешувајќи ја зависноста од тип за vnatresno/kajKlient.
 * video → rez, graphic → krea (PRD §4.1, CLAUDE.md И4).
 */
export function ownerOf(status: TaskStatus, contentType: ContentType): Role | null {
  if (status === 'vnatresno' || status === 'kajKlient') {
    return contentType === 'video' ? 'rez' : 'krea';
  }
  return TASK_STATUS_META[status].owner;
}

/**
 * Терминални статуси. `objaveno` е терминален САМО ако клиентот нема Meta Ads (D-6);
 * инаку системски преминува во analitika во иста трансакција.
 */
export function isTerminal(status: TaskStatus, usesMetaAds: boolean): boolean {
  if (status === 'zavrseno' || status === 'otkazano') return true;
  if (status === 'objaveno') return !usesMetaAds;
  return false;
}

/** Статуси без заклучена работна зона (терминали + пауза + резервиран) (PRD §4.1). */
export function isWorkZoneLockable(status: TaskStatus): boolean {
  return !(
    status === 'objaveno' ||
    status === 'zavrseno' ||
    status === 'otkazano' ||
    status === 'pauza' ||
    status === 'mrtov'
  );
}
