import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// .env.local се вчитува рачно (без dotenv зависност; без hardcoded секрети — CLAUDE §12).
// Playwright го стартува api преку webServer.env, па му ги предаваме овие вредности.
const root = dirname(fileURLToPath(import.meta.url));
function loadEnvLocal(): Record<string, string> {
  try {
    const raw = readFileSync(resolve(root, '.env.local'), 'utf8');
    const out: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[1]) out[m[1]] = (m[2] ?? '').replace(/^["']|["']$/g, '');
    }
    return out;
  } catch {
    return {};
  }
}

const apiEnv = { ...loadEnvLocal(), NODE_ENV: 'development' };

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    locale: 'mk-MK',
    timezoneId: 'Europe/Skopje',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'pnpm --filter @gd/api dev',
      port: 3001,
      timeout: 90_000,
      reuseExistingServer: true,
      env: apiEnv,
    },
    {
      command: 'pnpm --filter @gd/web dev',
      port: 5173,
      timeout: 90_000,
      reuseExistingServer: true,
    },
  ],
});
