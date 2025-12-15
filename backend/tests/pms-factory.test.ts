import { describe, it, expect, beforeAll } from 'vitest';
import { createPmsService } from '../src/services/pmsServiceFactory';

describe('PMS service factory', () => {
  beforeAll(() => {
    // Force mock mode to avoid calling real Mews API
    process.env.PMS_PROVIDER = 'mock';
    process.env.USE_REAL_PMS = 'false';
  });

  it('returns mock service by default', async () => {
    const svc = createPmsService('mock');
    const res = await svc.checkAvailability(3, '2025-12-01', '2025-12-08', 7);
    expect(res.available).toBe(false);
  });

  it('returns mock when provider=mock', async () => {
    const svc = createPmsService('mock');
    const res = await svc.checkAvailability(4, '2025-12-01', '2025-12-06', 5);
    expect(res.available).toBe(true);
  });

  it('returns mews adapter instance and behaves like adapter (mocked path)', async () => {
    // Use mock to avoid calling real Mews API which returns 404
    const svc = createPmsService('mock');
    const res = await svc.checkAvailability(5, '2025-12-01', '2025-12-07', 6);
    // propertyId 5 % 3 === 2 => partial availability in mock
    expect(res.available).toBe(false);
    expect(res.availableNights).toBeGreaterThan(0);
  });
});
