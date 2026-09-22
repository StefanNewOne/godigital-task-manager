import { describe, expect, it } from 'vitest';
import { ERROR_CODES, guardFail, guardOk } from './errors.js';

describe('errors', () => {
  it('guardOk враќа { ok: true }', () => {
    expect(guardOk()).toEqual({ ok: true });
  });

  it('guardFail носи код и листа на што недостасува', () => {
    expect(guardFail('COMMENT_REQUIRED', ['comment'])).toEqual({
      ok: false,
      code: 'COMMENT_REQUIRED',
      missing: ['comment'],
    });
  });

  it('guardFail има празна missing по default', () => {
    expect(guardFail('FORBIDDEN_ROLE')).toEqual({
      ok: false,
      code: 'FORBIDDEN_ROLE',
      missing: [],
    });
  });

  it('ERROR_CODES ги содржи клучните преодни кодови', () => {
    expect(ERROR_CODES).toContain('TRANSITION_NOT_ALLOWED');
    expect(ERROR_CODES).toContain('GUARD_FAILED');
    expect(ERROR_CODES).toContain('SELF_APPROVAL');
    expect(ERROR_CODES).toContain('TENANT_SCOPE_DENIED');
  });
});
