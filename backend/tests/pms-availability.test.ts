import { describe, it, expect } from 'vitest';
import PmsMockService from '../src/services/pmsMockService';

describe('PMS Mock availability', () => {
  it('returns no availability for propertyId divisible by 3', async () => {
    const res = await PmsMockService.checkAvailability(3, '2025-12-01', '2025-12-08', 7);
    expect(res.available).toBe(false);
    expect(res.availableNights).toBe(0);
    expect(res.reason).toBe('no_availability');
  });

  it('returns full availability for propertyId % 3 === 1', async () => {
    const required = 5;
    const res = await PmsMockService.checkAvailability(4, '2025-12-01', '2025-12-06', required);
    expect(res.available).toBe(true);
    expect(res.availableNights).toBe(required);
  });

  it('returns partial availability for propertyId % 3 === 2', async () => {
    const required = 6;
    const res = await PmsMockService.checkAvailability(5, '2025-12-01', '2025-12-07', required);
    expect(res.available).toBe(false);
    expect(res.availableNights).toBeGreaterThan(0);
    expect(res.availableNights).toBeLessThan(required);
    expect(res.reason).toBe('partial');
  });
});
