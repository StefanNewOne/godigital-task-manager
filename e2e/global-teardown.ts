import { loadEnvLocal, cleanupE2e, disconnectE2e } from './fixtures.js';

/** Playwright globalTeardown — исчисти ги e2e ентитетите по сите spec-ови. */
export default async function globalTeardown(): Promise<void> {
  loadEnvLocal();
  await cleanupE2e();
  await disconnectE2e();
}
