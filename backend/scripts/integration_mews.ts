import 'dotenv/config';
import { createPmsService } from '../src/services/pmsServiceFactory';

(async () => {
  try {
    const svc: any = createPmsService('mews');
    console.log('Using PMS service:', svc.constructor.name);
    const payload = {
      propertyId: 1,
      guestName: 'Demo Integration Guest',
      guestEmail: 'demo-guest@example.com',
      checkIn: '2025-12-05',
      checkOut: '2025-12-08',
      roomType: 'standard',
      nights: 3,
    };

    const res = await svc.createBooking(payload);
    console.log('createBooking result:', res);
    process.exit(0);
  } catch (err: any) {
    console.error('Integration error:', err && err.stack ? err.stack : err);
    process.exit(2);
  }
})();
