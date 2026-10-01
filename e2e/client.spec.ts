import { test, expect } from '@playwright/test';

/**
 * Клиентски PWA (Фаза D3). Data-independent текови — длабокото одобрување/враќање е покриено
 * со API integration тестовите (client-approvals.integration.test.ts).
 */
test.describe('Клиентски PWA (Фаза D)', () => {
  test('/client прикажува landing за пристап', async ({ page }) => {
    await page.goto('/client');
    await expect(page.getByRole('heading', { name: 'Пристап до одобрувања' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Испрати линк' })).toBeVisible();
  });

  test('барање линк прикажува генеричка потврда (без enumeration)', async ({ page }) => {
    await page.goto('/client');
    await page.locator('input[type="email"]').fill('nekoj@klient.mk');
    await page.getByRole('button', { name: 'Испрати линк' }).click();
    await expect(page.getByText(/ви испративме линк за пристап/)).toBeVisible();
  });

  test('неважечки токен → порака за истечен линк', async ({ page }) => {
    await page.goto('/client?token=nevaliden-token');
    await expect(page.getByText(/неважечки или истечен/)).toBeVisible();
  });
});
