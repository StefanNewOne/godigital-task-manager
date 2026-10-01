import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

test.describe('Rule Builder (H3)', () => {
  test('„Ново правило" отвора форма со типизирани полиња', async ({ page }) => {
    await login(page);
    await page.goto('/admin/alarms');
    await expect(page.getByRole('columnheader', { name: 'Акции' })).toBeVisible();
    await page.getByRole('button', { name: 'Ново правило' }).click();
    await expect(page.getByRole('heading', { name: 'Ново правило' })).toBeVisible();
    await expect(page.getByText('Тип тригер')).toBeVisible();
    await expect(page.getByText('Денови (праг)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Зачувај' })).toBeVisible();
  });
});
