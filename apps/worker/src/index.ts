/**
 * @gd/worker — BullMQ scheduler + jobs.
 * Правилна архитектура: worker-от само РАСПОРЕДУВА (cron), а API-то ГИ ИЗВРШУВА со tenant
 * контекст + CRON_SECRET. Секое правило = repeatable job што повикува API cron endpoint.
 *
 * Регистрирани cron jobs:
 *   slots.generate       0 6 20 * *   → /api/cron/slots-generate       (месечни слотови)
 *   evaluate.alarms      0 7 * * *    → /api/cron/evaluate-alarms      (аларми за покриеност, B1)
 *   notifications.digest 0 7 * * *    → /api/cron/notifications-digest (дневен преглед за Директор, B1)
 *
 * Иднина: outbox.drain (real-time/знаење), knowledge.index (B4), metrics.pull (B2),
 * publication.resolve (B2), files.preview (B3).
 */
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6479';
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const CRON_SECRET = process.env.CRON_SECRET ?? 'dev-cron-secret-change-me';

export const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

interface CronJob {
  name: string;
  pattern: string; // cron израз (Europe/Skopje)
  endpoint: string;
}

const CRON_JOBS: CronJob[] = [
  { name: 'slots.generate', pattern: '0 6 20 * *', endpoint: '/api/cron/slots-generate' },
  { name: 'evaluate.alarms', pattern: '0 7 * * *', endpoint: '/api/cron/evaluate-alarms' },
  {
    name: 'notifications.digest',
    pattern: '0 7 * * *',
    endpoint: '/api/cron/notifications-digest',
  },
];

const CRON_QUEUE = 'cron';
export const cronQueue = new Queue(CRON_QUEUE, { connection });

/** Регистрира ги сите repeatable cron jobs (идемпотентно по jobId). */
export async function registerSchedulers(): Promise<void> {
  for (const job of CRON_JOBS) {
    await cronQueue.add(
      job.name,
      { endpoint: job.endpoint },
      {
        repeat: { pattern: job.pattern, tz: 'Europe/Skopje' },
        jobId: `${job.name}.scheduler`,
        removeOnComplete: true,
        removeOnFail: 50,
      },
    );
  }
}

export const cronWorker = new Worker<{ endpoint: string }>(
  CRON_QUEUE,
  async (job) => {
    const res = await fetch(`${API_URL}${job.data.endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`${job.data.endpoint} врати ${res.status}`);
    return res.json();
  },
  { connection },
);

if (process.env.NODE_ENV !== 'test') {
  registerSchedulers()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log(`gd-worker: ${CRON_JOBS.length} cron scheduler(и) регистрирани (Europe/Skopje).`);
    })
    .catch((e) => {
      console.error('gd-worker: неуспешна регистрација на scheduler', e);
    });
}
