import { get, set } from 'idb-keyval';

/** Мутација зачувана офлајн, за повторно праќање при враќање мрежа (C3). */
export interface QueuedMutation {
  id: string; // = Idempotency-Key (стабилен при replay)
  method: string;
  path: string;
  body?: unknown;
  at: number;
}

const KEY = 'gd-offline-queue';
type Listener = (count: number) => void;
const listeners = new Set<Listener>();

async function read(): Promise<QueuedMutation[]> {
  return (await get<QueuedMutation[]>(KEY)) ?? [];
}
async function write(q: QueuedMutation[]): Promise<void> {
  await set(KEY, q);
  for (const l of listeners) l(q.length);
}

export function onQueueChange(l: Listener): () => void {
  listeners.add(l);
  void read().then((q) => l(q.length));
  return () => listeners.delete(l);
}

export async function enqueueMutation(m: QueuedMutation): Promise<void> {
  const q = await read();
  q.push(m);
  await write(q);
}

export async function queueLength(): Promise<number> {
  return (await read()).length;
}

/**
 * Испрати ги зачуваните мутации по ред. Idempotency-Key спречува дупликат на серверот.
 * Ставка што успеала или е трајно одбиена (4xx освен 409/429) се вади од редот;
 * мрежна грешка го прекинува flush-от (ќе се повтори следен пат).
 */
export async function flushQueue(): Promise<{ sent: number; failed: number }> {
  let q = await read();
  let sent = 0;
  let failed = 0;
  while (q.length > 0) {
    const m = q[0]!;
    let res: Response;
    try {
      res = await fetch(`/api${m.path}`, {
        method: m.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'Idempotency-Key': m.id,
        },
        body: m.body !== undefined ? JSON.stringify(m.body) : undefined,
      });
    } catch {
      break; // сè уште офлајн — застани, пробај подоцна
    }
    // 2xx = успех; трајна грешка (4xx освен 409/429) = вади ја (нема смисла повторно).
    const permanent =
      res.status >= 400 && res.status < 500 && res.status !== 409 && res.status !== 429;
    if (res.ok) sent++;
    else if (permanent) failed++;
    else break; // 5xx/409/429 → повтори подоцна
    q = q.slice(1);
    await write(q);
  }
  return { sent, failed };
}
