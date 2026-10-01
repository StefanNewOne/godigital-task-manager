/**
 * Каталог на типови настани (CLAUDE.md §6/§4.12). Единствен извор на вистина за `eventType`.
 *
 * `recordEvent` го типизира `eventType: EventType`, па НОВ настан МОРА да се додаде овде за да
 * помине typecheck — compile-time гаранција дека секој eventType е каталогизиран (нема „сирак"
 * настан). Наративите се детерминистички, на македонска кирилица, БЕЗ LLM; се градат на местото
 * на повикот со контекст од ентитетите (task.title, client.name, ROLE_LABEL). Централно живеат
 * каталогот + празен-наратив гардот во `recordEvent` (И2: „нема EventLog без наратив").
 *
 * При додавање нов eventType: додади го тука + осигурај наратив на местото на `recordEvent`.
 */
export const EVENT_TYPES = [
  // таск
  'task.transition',
  'task.paused',
  'task.cancelled',
  'task.resumed',
  'task.dateChanged',
  'task.extraCreated',
  // капа (TaskGroup)
  'taskGroup.created',
  'taskGroup.transition',
  'taskGroup.bulkActivated',
  // сценарија
  'scenarios.split',
  'scenarios.outcomes',
  'scenario.updated',
  // слотови / календар / снимања
  'slots.generated',
  'monthlyPlan.generated',
  'month.confirmed',
  'slot.moved',
  'shoot.added',
  'monthlyPlan.confirmed',
  'monthlyCalendar.approved',
  // клиент / контакти
  'client.created',
  'client.updated',
  'client.deactivated',
  'client.reactivated',
  'client.activatedFromLead',
  'clientContact.created',
  'clientContact.updated',
  // вработени / празници / календар-конфиг
  'employee.created',
  'employee.updated',
  'holiday.created',
  'calendarConfig.saved',
  // публикации
  'promotion.decided',
  // CRM (продажба)
  'lead.created',
  'lead.transition',
  'lead.docUploaded',
  'lead.meetingUpdated',
  'lead.meetingNoShow',
  'lead.packageUpdated',
  'lead.planUpdated',
  'lead.teamUpdated',
  'lead.reassigned',
  // Meta
  'meta.profile.updated',
  'meta.conversation.opened',
  'meta.plan.created',
  'meta.plan.approved',
  'meta.plan.rejected',
  'meta.plan.marked_done',
  'meta.plan.withdrawn',
  'meta.plan.confirmed',
  'meta.plan.mismatch',
] as const;

export type EventType = (typeof EVENT_TYPES)[number];

const EVENT_TYPE_SET: ReadonlySet<string> = new Set(EVENT_TYPES);

/** Дали стрингот е каталогизиран eventType (type guard). */
export function isKnownEventType(value: string): value is EventType {
  return EVENT_TYPE_SET.has(value);
}
