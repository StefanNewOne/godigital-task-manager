/**
 * @gd/worker — BullMQ jobs + ffmpeg.
 * Регистрирани: slots.generate (A2, cron 0 6 20 * * Europe/Skopje) → повикува API cron endpoint.
 * Иднина: outbox.drain (A1 real-time/знаење/известувања), knowledge.index (B4), metrics.pull (B2),
 * publication.resolve (B2), files.preview (B3), notifications.digest (B1).
 */
import { Queue, Worker } from 'bullmq';
import IORedis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6479';
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const CRON_SECRET = process.env.CRON_SECRET ?? 'dev-cron-secret-change-me';

export const connection = new IORedis(REDIS_URL, { maxRetriesPerRequest: null });

const SLOTS_QUEUE = 'slots';
export const slotsQueue = new Queue(SLOTS_QUEUE, { connection });

/** Регистрира репетитивен job за месечно генерирање слотови (идемпотентно на API страна). */
export async function registerSchedulers(): Promise<void> {
  await slotsQueue.add(
    'slots.generate',
    {},
    {
      repeat: { pattern: '0 6 20 * *', tz: 'Europe/Skopje' },
      jobId: 'slots.generate.monthly',
      removeOnComplete: true,
      removeOnFail: 50,
    },
  );
}

export const slotsWorker = new Worker(
  SLOTS_QUEUE,
  async () => {
    const res = await fetch(`${API_URL}/api/cron/slots-generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': CRON_SECRET },
      body: JSON.stringify({}),
    });
    if (!res.ok) throw new Error(`cron slots-generate врати ${res.status}`);
    return res.json();
  },
  { connection },
);

if (process.env.NODE_ENV !== 'test') {
  registerSchedulers()
    .then(() => {
      // eslint-disable-next-line no-console
      console.log('gd-worker: slots.generate scheduler регистриран (0 6 20 * * Europe/Skopje).');
    })
    .catch((e) => {
      console.error('gd-worker: неуспешна регистрација на scheduler', e);
    });
}
