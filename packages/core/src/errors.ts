/**
 * Кодови за грешки (SCREAMING_SNAKE). API ги враќа во облик
 * `{ code, message, details? }` со `message` на македонски (CLAUDE.md §16).
 */
export const ERROR_CODES = [
  // преоди / state machine
  'TRANSITION_NOT_ALLOWED',
  'GUARD_FAILED',
  'FORBIDDEN_ROLE',
  'SELF_APPROVAL',
  'COMMENT_REQUIRED',
  'PUBLICATION_REQUIRED',
  // слотови / датуми
  'SLOT_TAKEN',
  'DATE_IN_PAST',
  // опсег / auth
  'TENANT_SCOPE_DENIED',
  'CLIENT_SCOPE_DENIED',
  'UNAUTHENTICATED',
  // валидација
  'VALIDATION_FAILED',
  'NOT_FOUND',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Резултат на guard (PRD §4.3): успех, или неуспех со код и листа на што недостасува. */
export type GuardResult = { ok: true } | { ok: false; code: ErrorCode; missing: string[] };

export const guardOk = (): GuardResult => ({ ok: true });

export const guardFail = (code: ErrorCode, missing: string[] = []): GuardResult => ({
  ok: false,
  code,
  missing,
});
