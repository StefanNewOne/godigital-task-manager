import { test, expect } from '@playwright/test';
import { login } from './helpers.js';
import { readSeedIds } from './fixtures.js';

/** Капа bulk-активација (D-3, §18 „Активирај ги сите слотови") — gPodgotovka → активирај → toast. */
test('капа bulk активација прикажува success toast', async ({ page }) => {
  const { bulkGroupId } = readSeedIds();
  await login(page);
  await page.goto(`/tasks?capa=${bulkGroupId}`);
  const btn = page.getByRole('button', { name: /Активирај 3 таск/ });
  await expect(btn).toBeVisible();
  await btn.click();
  await expect(page.getByText('Активирани 3 таска.')).toBeVisible();
});
