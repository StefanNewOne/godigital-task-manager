import { expect, type Page } from '@playwright/test';

/** Seed креденцијали (packages/db/prisma/seed.ts). */
export const DIRECTOR = { email: 'aleks@godigital.mk', password: 'gd-devpass-2026' };

/** Најавување преку формата; чека да се појави апликацискиот shell. */
export async function login(page: Page, who = DIRECTOR): Promise<void> {
  await page.goto('/');
  await page.locator('input[type="email"]').fill(who.email);
  await page.locator('input[type="password"]').fill(who.password);
  await page.getByRole('button', { name: 'Најави се' }).click();
  // По успешна најава — навигацијата (rail) со „Преглед" се појавува.
  await expect(page.getByRole('link', { name: 'Преглед' })).toBeVisible();
}
