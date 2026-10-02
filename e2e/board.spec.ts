import { test, expect } from '@playwright/test';
import { login } from './helpers.js';
import { readSeedIds } from './fixtures.js';

/** Board (Табла) — seeded таск се појавува во статус-колона (harness-seeded, §18 „Табла"). */
test('Табла прикажува seeded таск', async ({ page }) => {
  const { clientId, dateTaskTitle } = readSeedIds();
  await login(page);
  await page.goto(`/tasks?tab=board&client=${clientId}`);
  await expect(page.getByText(dateTaskTitle)).toBeVisible();
});
