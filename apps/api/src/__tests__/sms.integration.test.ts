import { describe, it, expect } from 'vitest';
import { sendSms } from '../lib/sms.js';

/** O-B1: SMS адаптер (Twilio). Без credentials / во test → dev-stub (false), best-effort (не фрла). */
describe('sendSms (O-B1)', () => {
  it('без Twilio credentials → false и не фрла', async () => {
    await expect(sendSms('+38970123456', 'Критичен аларм: тест')).resolves.toBe(false);
  });
});
