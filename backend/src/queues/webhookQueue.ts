type JobPayload = { webhookId: number };

let inMemory = true;
let bullAvailable = false;
let queueStarted = false;
const getProcessor = async () => {
  // dynamic import to avoid circular imports and work in vitest/ts-node
  const w = await import('../workers/webhookWorker');
  return w.processWebhook || w.default?.processWebhook || w.default?.processWebhook;
};
let addJobImpl: (webhookId: number) => Promise<any> = async (webhookId: number) => {
  // default no-op
  return Promise.resolve({ id: webhookId });
};
let startImpl: () => Promise<void> = async () => {
  queueStarted = true;
  return Promise.resolve();
};

try {
  // Only attempt to require BullMQ when explicitly requested via env.
  const useBullEnv = (process.env.USE_BULL || process.env.use_bull || '').toString();
  if (useBullEnv.toLowerCase() === 'true') {
    // dynamic require to avoid hard dependency in test env
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Queue, Worker, QueueScheduler } = require('bullmq');
    const redisUrl = process.env.REDIS_URL || process.env.redis_url || 'redis://127.0.0.1:6379';

    const queue = new Queue('mews-webhooks', { connection: { url: redisUrl } });
    // Queue scheduler for delayed jobs/retries
    const scheduler = new QueueScheduler('mews-webhooks', { connection: { url: redisUrl } });
    const worker = new Worker('mews-webhooks', async (job: any) => {
      const payload: JobPayload = job.data;
      const defaultProcessor = await getProcessor();
      await defaultProcessor(payload.webhookId);
    }, { connection: { url: redisUrl } });

    bullAvailable = true;
    inMemory = false;

    addJobImpl = async (webhookId: number) => {
      return queue.add('process', { webhookId });
    };

    startImpl = async () => {
      queueStarted = true;
      return Promise.resolve();
    };
  }
} catch (err) {
  // fall back to in-memory queue
  inMemory = true;
}

// In-memory queue fallback
if (inMemory) {
  const pending: number[] = [];

  const processNext = async () => {
    if (pending.length === 0) return;
    const id = pending.shift()!;
    try {
      const defaultProcessor = await getProcessor();
      await defaultProcessor(id);
    } catch (err) {
      console.error('In-memory job processing error', err);
    }
    // schedule next
    setImmediate(processNext);
  };

  addJobImpl = async (webhookId: number) => {
    pending.push(webhookId);
    // start processing if not already
    setImmediate(processNext);
    return Promise.resolve({ id: webhookId });
  };

  startImpl = async () => {
    queueStarted = true;
    return Promise.resolve();
  };
}

// Exports typed wrappers
export const addJob = (webhookId: number) => addJobImpl(webhookId);
export const start = () => startImpl();

export default { addJob, start };
