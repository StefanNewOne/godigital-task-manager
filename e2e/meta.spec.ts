import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test.describe('Мета', () => {
  test('сите табови се рендерираат', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Мета' }).click();
    await expect(page).toHaveURL(/\/meta/);
    await expect(page.getByRole('button', { name: 'Утрински преглед' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Планови' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Поврзувања' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Инбокс' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Коментари' })).toBeVisible();
  });

  test('Планови · proposal филтри и ново копче (D1 предлог тек)', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Мета' }).click();
    await page.getByRole('button', { name: 'Планови' }).click();
    await expect(page).toHaveURL(/tab=plans/);
    await expect(page.getByRole('button', { name: 'На чекање' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Одобрени' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Нов план/ })).toBeVisible();
  });
});
