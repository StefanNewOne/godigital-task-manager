import type { ContentType, Role } from '../roles.js';
import type { TaskStatus } from '../statuses.js';
import { isTerminal } from '../statuses.js';

/**
 * Специјални преоди (PRD §4.3). Не се обични редови во матрицата бидејќи важат за
 * „било кој не-терминален" статус. Actor-проверката и guards се тука; effects во api.
 */

/** Пауза: било кој не-терминален освен mrtov/pauza. Actor: dir или am. Guard: G_COMMENT. Effect: E_RELEASE_SLOT. */
export function canPause(from: TaskStatus, actor: Role): boolean {
  if (actor !== 'dir' && actor !== 'am') return false;
  if (from === 'mrtov' || from === 'pauza') return false;
  // usesMetaAds не е потребен тука — терминалност за пауза значи која било терминална.
  return !isTerminalAnyMeta(from);
}

/** Откажан: било кој не-терминален. Actor: само dir. Guard: G_COMMENT. Effect: E_RELEASE_SLOT. */
export function canCancel(from: TaskStatus, actor: Role): boolean {
  if (actor !== 'dir') return false;
  return !isTerminalAnyMeta(from);
}

/**
 * Реактивација на пропуштен резервиран слот: mrtov → brifing (графика) / cekaSnimanje (видео).
 * Actor: dir/am, или krea (графика) / rez (видео). Guard: G_SLOT_FREE (нов датум).
 */
export function canReactivateMissed(actor: Role, contentType: ContentType): boolean {
  if (actor === 'dir' || actor === 'am') return true;
  if (contentType === 'graphic') return actor === 'krea';
  return actor === 'rez';
}

/** Враќање од пауза во претходниот статус. Actor: dir/am. Guard: G_SLOT_FREE. */
export function canResumeFromPause(actor: Role): boolean {
  return actor === 'dir' || actor === 'am';
}

/** Терминалност независна од Meta Ads (за пауза/откажан правилата). */
function isTerminalAnyMeta(from: TaskStatus): boolean {
  // objaveno е терминален само без Meta Ads; за пауза/откажан го третираме conservatively:
  // ако е zavrseno/otkazano — сигурно терминален. objaveno може да продолжи во analitika,
  // па НЕ го третираме како строго терминален тука (може да се паузира пред analitika? не —
  // objaveno е мирување; пауза од objaveno нема смисла). Земаме usesMetaAds=false како строг случај.
  return isTerminal(from, false) || from === 'objaveno';
}
