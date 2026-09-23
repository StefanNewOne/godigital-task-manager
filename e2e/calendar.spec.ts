import { test, expect, type Page } from '@playwright/test';
import { login } from './helpers.js';

// Стандарден клиент со видео+графика (seed). `specificen` (Студио Тон) бара рачен внес — избегнато.
const CLIENT = 'Филтер Вода';

/** Оди напред по месеци додека не најде месец без слотови (празна состојба). */
async function gotoEmptyMonth(page: Page): Promise<void> {
  const generateBtn = page.getByRole('button', { name: 'Генерирај распоред' });
  for (let i = 0; i < 10; i++) {
    if (await generateBtn.isVisible().catch(() => false)) return;
    // ако месецот веќе има proposal од претходно пуштање, продолжи напред
    await page.getByRole('button', { name: 'Следен месец' }).click();
    await page.waitForTimeout(400); // слотовите се пребаруваат по промена на месец
  }
  throw new Error('Не најдов празен иден месец за тестот.');
}

test.describe('Календар — потврда на месец (A2)', () => {
  test('генерирање предлог → потврди месец → резервирани слотови', async ({ page }) => {
    await login(page);
    await page.getByRole('link', { name: 'Календар' }).click();
    await expect(page).toHaveURL(/\/calendar/);

    // Избери стандарден клиент.
    await page.locator('select').first().selectOption({ label: CLIENT });

    // Најди празен месец и генерирај предлог-распоред.
    await gotoEmptyMonth(page);
    await page.getByRole('button', { name: 'Генерирај распоред' }).click();

    // Предлог банерот се појавува со копче „Потврди месец".
    const confirmBtn = page.getByRole('button', { name: 'Потврди месец' });
    await expect(confirmBtn).toBeVisible();
    await expect(page.getByText(/Предлог за .*видео/)).toBeVisible();

    // Потврди месецот.
    await confirmBtn.click();

    // Toast за успешна резервација; предлог банерот исчезнува.
    await expect(page.getByText('Месецот е потврден. Слотовите се резервирани.')).toBeVisible();
    await expect(confirmBtn).toHaveCount(0);
  });
});
