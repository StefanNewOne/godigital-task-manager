import { test, expect } from '@playwright/test';
import { login, DIRECTOR } from './helpers.js';

test.describe('Најава и навигација', () => {
  test('ненајавен корисник ја гледа формата за најава', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('GoDigital Таск-менаџер')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
  });

  test('погрешна лозинка не најавува', async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="email"]').fill(DIRECTOR.email);
    await page.locator('input[type="password"]').fill('погрешна-лозинка');
    await page.getByRole('button', { name: 'Најави се' }).click();
    // Остануваме на најава — rail „Преглед" не се појавува.
    await expect(page.getByRole('link', { name: 'Преглед' })).toHaveCount(0);
  });

  test('директор се најавува и стигнува на Преглед', async ({ page }) => {
    await login(page);
    await expect(page.getByText('Покриеност по клиент')).toBeVisible();
    await expect(page.getByText('Работа по статус')).toBeVisible();
  });

  test('навигација низ главните екрани', async ({ page }) => {
    await login(page);

    await page.getByRole('link', { name: 'Клиенти' }).click();
    await expect(page).toHaveURL(/\/clients/);
    // Насловот „Клиенти" е во топ-лентата; содржината ја потврдуваме преку колоната.
    await expect(page.getByRole('columnheader', { name: 'Покриеност' })).toBeVisible();

    await page.getByRole('link', { name: 'Календар' }).click();
    await expect(page).toHaveURL(/\/calendar/);

    await page.getByRole('link', { name: 'Аналитика' }).click();
    await expect(page.getByText(/Фаза B2/)).toBeVisible();

    await page.getByRole('link', { name: 'Админ' }).click();
    await expect(page).toHaveURL(/\/admin/);
  });
});
