import { test, expect } from '@playwright/test';

test.describe('Заборавена лозинка (H4)', () => {
  test('Login → линк отвора екран за ресетирање', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Заборавена лозинка?' }).click();
    await expect(page).toHaveURL(/\/forgot-password/);
    await expect(page.getByRole('heading', { name: 'Ресетирај лозинка' })).toBeVisible();
  });

  test('барање за ресет прикажува генеричка потврда', async ({ page }) => {
    await page.goto('/forgot-password');
    await page.locator('input[type="email"]').fill('aleks@godigital.mk');
    await page.getByRole('button', { name: 'Испрати линк' }).click();
    await expect(page.getByText(/Ако постои сметка/)).toBeVisible();
  });

  test('екранот за нова лозинка се рендерира од линкот', async ({ page }) => {
    await page.goto('/reset-password?token=demo-token');
    await expect(page.getByRole('heading', { name: 'Нова лозинка' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Зачувај лозинка' })).toBeVisible();
  });
});
