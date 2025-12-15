import 'dotenv/config';
import { createPmsService } from '../services/pmsServiceFactory';

async function main() {
  try {
    console.log('Creating PMS service (mews)');
    const svc: any = createPmsService('mews');
    console.log('Testing availability (propertyId=1, sample dates)');
    const res = await svc.checkAvailability(1, '2025-12-01', '2025-12-05', 4);
    console.log('Mews availability response:', res);
    process.exit(0);
  } catch (err: any) {
    console.error('Mews connectivity check failed:', err?.message || err);
    process.exit(2);
  }
}

main();
