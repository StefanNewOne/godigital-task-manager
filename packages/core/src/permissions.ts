import type { ContentType, Role } from './roles.js';
import type { GroupStatus, TaskStatus } from './statuses.js';

/** Екрани во навигацијата (Handoff `ROLE_CFG.nav`). */
export const SCREENS = ['director', 'list', 'calendar', 'clients', 'analytics', 'admin'] as const;

export type Screen = (typeof SCREENS)[number];

/**
 * Дозволи — една табела (PRD §4.11).
 *   `nav`/`scope`  — од Handoff `ROLE_CFG` (видливост на екрани, опсег на видливост).
 *   `canCreate`/`canChangeDate` — типови содржина што улогата смее да ги создава / чие датум може да го менува.
 *   `ownsTaskStatuses`/`ownsCapaStatuses` — статуси чија работна зона улогата ја носи (PRD §2 матрица).
 *   `specials` — специјални преоди (само Директор, D-5).
 *
 * scope: 'own' гледа само доделени таскови; 'all' гледа сè (само видливост, не акција).
 */
export interface RolePermissions {
  nav: readonly Screen[];
  scope: 'all' | 'own';
  canCreate: readonly ContentType[];
  canChangeDate: readonly ContentType[];
  ownsTaskStatuses: readonly TaskStatus[];
  ownsCapaStatuses: readonly GroupStatus[];
  specials?: readonly string[];
}

export const PERMISSIONS: Record<Role, RolePermissions> = {
  dir: {
    nav: ['director', 'list', 'calendar', 'clients', 'analytics', 'admin'],
    scope: 'all',
    canCreate: [],
    canChangeDate: ['video', 'graphic'],
    ownsTaskStatuses: [],
    ownsCapaStatuses: [],
    specials: ['pauza', 'otkazano', 'mrtov->aktiven', 'date-change', 'on-behalf-of'],
  },
  am: {
    nav: ['director', 'list', 'calendar', 'clients', 'analytics'],
    scope: 'all',
    canCreate: [],
    canChangeDate: ['video', 'graphic'],
    ownsTaskStatuses: ['zaObjavuvanje', 'objaveno'],
    ownsCapaStatuses: [],
  },
  rez: {
    nav: ['director', 'list', 'calendar', 'clients', 'analytics'],
    scope: 'all',
    canCreate: ['video'],
    canChangeDate: ['video'],
    ownsTaskStatuses: ['chekaRezija', 'vnatresno', 'kajKlient'],
    ownsCapaStatuses: ['podgotovka', 'scenKajKlient'],
  },
  scen: {
    nav: ['list', 'calendar'],
    scope: 'own',
    canCreate: [],
    canChangeDate: [],
    ownsTaskStatuses: [],
    ownsCapaStatuses: ['scenarija'],
  },
  kam: {
    nav: ['list'],
    scope: 'own',
    canCreate: [],
    canChangeDate: [],
    ownsTaskStatuses: ['cekaSnimanje'],
    ownsCapaStatuses: ['snimanje'],
  },
  mon: {
    nav: ['list'],
    scope: 'own',
    canCreate: [],
    canChangeDate: [],
    ownsTaskStatuses: ['montaza'],
    ownsCapaStatuses: [],
  },
  krea: {
    nav: ['list', 'calendar', 'clients', 'analytics'],
    scope: 'all',
    canCreate: ['graphic'],
    canChangeDate: ['graphic'],
    ownsTaskStatuses: ['brifing', 'vnatresno', 'kajKlient'],
    ownsCapaStatuses: ['gPodgotovka'],
  },
  diz: {
    nav: ['list'],
    scope: 'own',
    canCreate: [],
    canChangeDate: [],
    ownsTaskStatuses: ['dizajn'],
    ownsCapaStatuses: [],
  },
  ana: {
    nav: ['list', 'clients', 'analytics'],
    scope: 'all',
    canCreate: [],
    canChangeDate: [],
    ownsTaskStatuses: ['analitika'],
    ownsCapaStatuses: [],
  },
};

/** Дали улогата гледа даден екран. */
export function canSeeScreen(role: Role, screen: Screen): boolean {
  return PERMISSIONS[role].nav.includes(screen);
}

/** Дали улогата смее да создава даден тип содржина (само rez=video, krea=graphic). */
export function canCreate(role: Role, contentType: ContentType): boolean {
  return PERMISSIONS[role].canCreate.includes(contentType);
}

/** Дали улогата смее да го менува датумот на даден тип содржина. */
export function canChangeDate(role: Role, contentType: ContentType): boolean {
  return PERMISSIONS[role].canChangeDate.includes(contentType);
}
