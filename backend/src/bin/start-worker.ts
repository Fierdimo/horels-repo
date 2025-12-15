import 'dotenv/config';

import { start as startQueue } from '../queues/webhookQueue';
import { start as startBookingQueue } from '../queues/bookingQueue';

async function main() {
  try {
    console.log('Starting background worker...');
    // Start both webhook and booking queues (bookingQueue may use Bull when enabled)
    await Promise.all([startQueue(), startBookingQueue()]);
    console.log('Worker started. Listening for jobs on configured queues.');
  } catch (err) {
    console.error('Worker failed to start', err);
    process.exit(1);
  }
}

main();

process.on('SIGINT', () => {
  console.log('Worker stopping (SIGINT)');
  process.exit(0);
});
process.on('SIGTERM', () => {
  console.log('Worker stopping (SIGTERM)');
  process.exit(0);
});
