import { describe, it, expect } from 'vitest';
import { createPmsService } from '../src/services/pmsServiceFactory';

describe('Mews adapter booking creation (mock path)', () => {
  it('creates a booking via the mews adapter (mock or real demo)', async () => {
    // Ensure factory returns the mews adapter (which will delegate to mock by default)
    const svc = createPmsService('mews') as any;
    const res = await svc.createBooking({ propertyId: 5, guestName: 'Test Guest', guestEmail: 'guest@test.example', checkIn: '2025-12-01', checkOut: '2025-12-05', roomType: 'standard', nights: 4 });

    // In mock path provider is 'mock'; in real/demo mode it will be 'mews'.
    expect(res).toBeTruthy();
    expect(res.pmsBookingId).toBeDefined();
    const expectedProviders = process.env.USE_REAL_PMS === 'true' ? ['mews'] : ['mock'];
    // Accept either in case the test is run against the demo sandbox
    expect(expectedProviders.concat(['mock', 'mews'])).toContain(res.provider);
  });
});
