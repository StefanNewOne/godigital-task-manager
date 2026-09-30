import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test.describe('Задачи', () => {
  test('трите табови се рендерираат', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Задачи' }).click();
    await expect(page).toHaveURL(/\/tasks/);
    await expect(page.getByRole('button', { name: 'Мои задачи' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Список' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Табла' })).toBeVisible();
  });
});

test.describe('Админ', () => {
  test('матрица на улоги и дозволи (од @gd/core)', async ({ page }) => {
    await login(page);
    await page.goto('/admin/permissions');
    await expect(page.getByText(/П = пишува/)).toBeVisible();
    await expect(page.getByText('Директор', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('Продажен агент').first()).toBeVisible();
  });

  test('автоматизации — матрица на преоди (од @gd/core)', async ({ page }) => {
    await login(page);
    await page.goto('/admin/automations');
    await expect(page.getByText(/Секој статус го носи точно една улога/)).toBeVisible();
    await expect(page.getByText('Видео · капа таск')).toBeVisible();
  });

  test('аларми — системски правила со toggle', async ({ page }) => {
    await login(page);
    await page.goto('/admin/alarms');
    await expect(page.getByText(/Системските правила за известувања/)).toBeVisible();
    await expect(page.locator('button[role="switch"]').first()).toBeVisible();
  });
});
