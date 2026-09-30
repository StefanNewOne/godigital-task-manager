import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test.describe('Продажба (CRM)', () => {
  test('pipeline се рендерира со табови и чекори', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Продажба' }).click();
    await expect(page).toHaveURL(/\/crm/);
    await expect(page.getByRole('button', { name: 'Pipeline' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Одобрувања' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Изгубени' })).toBeVisible();
    // Колони од текот (data-independent):
    await expect(page.getByText('Анализа', { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Состанок', { exact: false }).first()).toBeVisible();
  });

  test('нов лид · празно поднесување бара задолжителни полиња (И5)', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Продажба' }).click();
    await page.getByRole('button', { name: '+ Нов лид' }).click();
    await expect(page.getByRole('heading', { name: 'Нов лид' })).toBeVisible();
    await page.getByRole('button', { name: 'Креирај лид' }).click();
    await expect(page.getByText(/Потребни се/)).toBeVisible();
  });

  test('нов лид · создавање отвора детален панел', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Продажба' }).click();
    await page.getByRole('button', { name: '+ Нов лид' }).click();
    const name = `Кафе E2E ${Date.now()}`;
    await page.getByRole('textbox', { name: 'Име на бизнис' }).fill(name);
    await page.getByRole('textbox', { name: 'Контакт лице' }).fill('Тест Лице');
    await page.getByRole('textbox', { name: 'Телефон' }).fill('070000000');
    await page.getByRole('button', { name: 'Креирај лид' }).click();
    // По создавање, деталниот панел се отвора со името на лидот.
    await expect(page.getByText(name).first()).toBeVisible();
  });
});
