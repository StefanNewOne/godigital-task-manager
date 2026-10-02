import { test, expect } from '@playwright/test';
import { login } from './helpers.js';

/**
 * Регресија: employee `/clients` екранот НЕ смее да го фати client PWA realm-от.
 * Бев скршено (App.tsx `startsWith('/client')` го фаќаше и `/clients`) — сега точно `/client`
 * или под `/client/`.
 */
test('/clients отвора employee екран, не client PWA', async ({ page }) => {
  await login(page);
  await page.goto('/clients');
  await expect(page).toHaveURL(/\/clients$/);
  // Employee shell е присутен (рельса „Задачи"), а client-PWA landing-от НЕ е.
  await expect(page.getByRole('link', { name: 'Задачи' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Пристап до одобрувања' })).toHaveCount(0);
});
