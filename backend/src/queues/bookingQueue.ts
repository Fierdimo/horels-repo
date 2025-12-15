type BookingJob = { idempotencyKey?: string; weekId?: string; userId?: string; Reservations?: any[]; checkIn?: string; checkOut?: string; totalPrice?: number };

let inMemory = true;
let addJobImpl: (job: BookingJob) => Promise<any> = async (job: BookingJob) => Promise.resolve({ id: job.idempotencyKey || Date.now() });
let startImpl: () => Promise<void> = async () => Promise.resolve();

const getProcessor = async () => {
  const w = await import('../queues/bookingWorker');
  return w;
};

try {
  const useBullEnv = (process.env.USE_BULL || process.env.use_bull || '').toString();
  if (useBullEnv.toLowerCase() === 'true') {
    // dynamic require to avoid hard dependency in test env
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { Queue, Worker, QueueScheduler } = require('bullmq');
    const redisUrl = process.env.REDIS_URL || process.env.redis_url || 'redis://127.0.0.1:6379';

    const queue = new Queue('create-booking', { connection: { url: redisUrl } });
    const scheduler = new QueueScheduler('create-booking', { connection: { url: redisUrl } });
    const worker = new Worker('create-booking', async (job: any) => {
      const payload: BookingJob = job.data;
      // processor should be the bookingWorker module which exports a listener
      const processor = await getProcessor();
      // If bookingWorker exports an `onCreateBooking` handler, call it
      if (processor && typeof processor.onCreateBooking === 'function') {
        await processor.onCreateBooking(payload);
      }
    }, { connection: { url: redisUrl } });

    inMemory = false;
    addJobImpl = async (job: BookingJob) => queue.add('create', job);
    startImpl = async () => Promise.resolve();
  }
} catch (err) {
  inMemory = true;
}

if (inMemory) {
  const pending: BookingJob[] = [];
  const processNext = async () => {
    if (pending.length === 0) return;
    const job = pending.shift()!;
    try {
      const processor = await getProcessor();
      if (processor && typeof processor.onCreateBooking === 'function') {
        await processor.onCreateBooking(job);
      }
    } catch (e) {
      console.error('In-memory booking job error', e);
    }
    setImmediate(processNext);
  };

  addJobImpl = async (job: BookingJob) => {
    pending.push(job);
    setImmediate(processNext);
    return Promise.resolve({ id: job.idempotencyKey || Date.now() });
  };

  startImpl = async () => Promise.resolve();
}

export const addBookingJob = (job: BookingJob) => addJobImpl(job);
export const start = () => startImpl();

export default { addBookingJob, start };
