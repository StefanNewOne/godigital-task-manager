import { loadEnvLocal, seedE2e, disconnectE2e } from './fixtures.js';

/** Playwright globalSetup — seed детерминистички e2e ентитети пред сите spec-ови. */
export default async function globalSetup(): Promise<void> {
  loadEnvLocal();
  await seedE2e();
  await disconnectE2e();
}
