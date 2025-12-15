#!/usr/bin/env ts-node
import bookingQueue from '../src/queues/bookingQueue';

async function main() {
  try {
    // If the queue has a start method (Bull path), start it so it can schedule/process jobs.
    if (typeof (bookingQueue as any).start === 'function') {
      await (bookingQueue as any).start();
    }

    const payload = {
      userId: 1,
      propertyId: 101,
      startDate: '2026-03-01',
      endDate: '2026-03-08',
      metadata: { source: 'manual-test', notes: 'enqueue_booking demo' }
    };

    if (typeof (bookingQueue as any).addBookingJob !== 'function') {
      console.error('bookingQueue does not expose addBookingJob. Check the queue implementation.');
      process.exit(2);
    }

    await (bookingQueue as any).addBookingJob(payload);
    console.log('Enqueued booking job:', JSON.stringify(payload));

    // Give in-memory queue a moment to process (only relevant for in-memory fallback)
    await new Promise((r) => setTimeout(r, 500));

    // If the queue exposes a graceful stop/close, call it
    if (typeof (bookingQueue as any).stop === 'function') {
      await (bookingQueue as any).stop();
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed to enqueue booking job:', err);
    process.exit(1);
  }
}

main();
