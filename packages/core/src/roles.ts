/**
 * Улоги во системот. Точно една по вработен (PRD §4.4).
 * Клучевите се DB enum / API вредности / UI клучеви.
 */
export const ROLES = ['dir', 'am', 'rez', 'scen', 'kam', 'mon', 'krea', 'diz', 'ana'] as const;

export type Role = (typeof ROLES)[number];

/** Улога на систем (за автоматски преоди). */
export type Actor = Role | 'system';

/** Македонски етикети за улоги (UI ги чита од i18n; ова е канонскиот извор). */
export const ROLE_LABEL: Record<Role, string> = {
  dir: 'Директор',
  am: 'Акаунт менаџер',
  rez: 'Режисер',
  scen: 'Сценарист',
  kam: 'Камерман',
  mon: 'Монтажер',
  krea: 'Гр. креатор',
  diz: 'Гр. дизајнер',
  ana: 'Аналитичар',
};

export type ContentType = 'video' | 'graphic';

export const CONTENT_TYPES: readonly ContentType[] = ['video', 'graphic'] as const;
