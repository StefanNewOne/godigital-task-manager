/**
 * Модул 3 · Мета — гранулиран пристап по улога (META_TECH_SPEC §3).
 * Ова е ДОПОЛНИТЕЛНО на `PERMISSIONS.nav` (кој само го отвора табот „Мета"): внатре во модулот,
 * `am` гледа само Инбокс + Коментари; `ana` предлага но не одобрува и гледа само свои планови.
 * Серверот проверува на секој повик (не само UI).
 */

import type { Role } from '../roles.js';

/** Под-погледи во Мета модулот. */
export const META_VIEWS = [
  'overview',
  'clients',
  'client',
  'cross',
  'inbox',
  'comments',
  'plans',
  'archive',
  'connections',
  'assistant',
] as const;

export type MetaView = (typeof META_VIEWS)[number];

export interface MetaAccess {
  views: readonly MetaView[];
  /** Смее да создаде `MetaChangePlan`. */
  canProposePlan: boolean;
  /** Планот што го создава е веднаш `approved` (Директор). */
  planAutoApproved: boolean;
  /** Смее да одобри/одбие/означи „Направено". */
  canApprovePlan: boolean;
  /** Смее да уредува профил на клиент (цели, прагови). */
  canEditProfile: boolean;
  /** Гледа само свои планови (Аналитичар). */
  seesOwnPlansOnly: boolean;
}

const ALL_VIEWS = META_VIEWS;

/** Само dir/ana/am имаат пристап до Мета; другите улоги немаат запис. */
export const META_ACCESS: Partial<Record<Role, MetaAccess>> = {
  dir: {
    views: ALL_VIEWS,
    canProposePlan: true,
    planAutoApproved: true,
    canApprovePlan: true,
    canEditProfile: true,
    seesOwnPlansOnly: false,
  },
  ana: {
    views: ALL_VIEWS,
    canProposePlan: true,
    planAutoApproved: false,
    canApprovePlan: false,
    canEditProfile: false,
    seesOwnPlansOnly: true,
  },
  am: {
    views: ['inbox', 'comments'],
    canProposePlan: false,
    planAutoApproved: false,
    canApprovePlan: false,
    canEditProfile: false,
    seesOwnPlansOnly: false,
  },
};

export function metaAccess(role: Role): MetaAccess | undefined {
  return META_ACCESS[role];
}

/** Дали улогата воопшто има пристап до Мета. */
export function hasMetaAccess(role: Role): boolean {
  return META_ACCESS[role] !== undefined;
}

/** Дали улогата гледа даден под-поглед во Мета. */
export function metaCanSeeView(role: Role, view: MetaView): boolean {
  return META_ACCESS[role]?.views.includes(view) ?? false;
}
