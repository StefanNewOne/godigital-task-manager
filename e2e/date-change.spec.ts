import { test, expect } from '@playwright/test';
import { login } from './helpers.js';
import { readSeedIds } from './fixtures.js';

/** Промена на датум преку модал (И5 причина, §18 „Датуми") — отвори таск → модал → Потврди → Готово. */
test('промена на датум преку модал успева', async ({ page }) => {
  const { dateTaskId } = readSeedIds();
  await login(page);
  await page.goto(`/tasks?task=${dateTaskId}`);

  await page.getByRole('button', { name: 'Промени датум' }).click();

  const modal = page.locator('.gd-fade-up').filter({ hasText: 'Промена на датум' });
  await expect(modal).toBeVisible();
  await modal.locator('input[type="date"]').fill('2030-02-20');
  await modal.locator('textarea').fill('e2e причина за промена');
  await modal.getByRole('button', { name: 'Потврди' }).click();

  await expect(page.getByText('Готово.')).toBeVisible();
});
