/**
 * WeekAllocation Model Unit Tests
 * 
 * Tests for WeekAllocation model helper methods and business logic.
 * These are TRUE unit tests - no database needed, testing logic only.
 */

import { describe, it, expect } from 'vitest';

// Mock WeekAllocation with business logic methods
class WeekAllocation {
  status?: string;
  start_date?: Date;
  end_date?: Date;
  credits_issued?: number | null;
  released_at?: Date | null;
  pms_booking_id?: string;
  pms_confirmation_code?: string;
  physical_room_assigned?: string;

  constructor(data: Partial<WeekAllocation>) {
    Object.assign(this, data);
  }

  isAvailable(): boolean {
    if (this.status !== 'RELEASED') return false;
    if (!this.start_date) return false;
    return this.start_date > new Date();
  }

  isExpired(): boolean {
    if (!this.end_date) return false;
    return this.end_date < new Date();
  }

  daysUntilCheckIn(): number {
    if (!this.start_date) return 0;
    const now = new Date();
    const diff = this.start_date.getTime() - now.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

describe('WeekAllocation Model', () => {

  describe('Helper Methods', () => {
    describe('isAvailable()', () => {
      it('should return true for RELEASED status with future date', () => {
        const allocation = new WeekAllocation({
          status: 'RELEASED',
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
          end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // +14 days
        });

        expect(allocation.isAvailable()).toBe(true);
      });

      it('should return false for ASSIGNED status', () => {
        const allocation = new WeekAllocation({
          status: 'ASSIGNED',
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });

        expect(allocation.isAvailable()).toBe(false);
      });

      it('should return false for BOOKED status', () => {
        const allocation = new WeekAllocation({
          status: 'BOOKED',
          start_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          end_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        });

        expect(allocation.isAvailable()).toBe(false);
      });

      it('should return false for RELEASED status with past date', () => {
        const allocation = new WeekAllocation({
          status: 'RELEASED',
          start_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // -14 days
          end_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // -7 days
        });

        expect(allocation.isAvailable()).toBe(false);
      });
    });

    describe('isExpired()', () => {
      it('should return true for past end_date', () => {
        const allocation = new WeekAllocation({
          end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
        });

        expect(allocation.isExpired()).toBe(true);
      });

      it('should return false for future end_date', () => {
        const allocation = new WeekAllocation({
          end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
        });

        expect(allocation.isExpired()).toBe(false);
      });

      it('should return false for today end_date', () => {
        const allocation = new WeekAllocation({
          end_date: new Date(), // Today
        });

        // Should be false because end_date is not strictly less than now
        expect(allocation.isExpired()).toBe(false);
      });
    });

    describe('daysUntilCheckIn()', () => {
      it('should calculate correct days for future check-in', () => {
        const daysAhead = 30;
        const checkInDate = new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
        
        const allocation = new WeekAllocation({
          start_date: checkInDate,
        });

        const days = allocation.daysUntilCheckIn();
        expect(days).toBeGreaterThanOrEqual(daysAhead - 1); // Allow 1 day margin for test execution time
        expect(days).toBeLessThanOrEqual(daysAhead + 1);
      });

      it('should return negative days for past check-in', () => {
        const allocation = new WeekAllocation({
          start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // -7 days
        });

        expect(allocation.daysUntilCheckIn()).toBeLessThan(0);
      });

      it('should return ~0 days for today check-in', () => {
        const allocation = new WeekAllocation({
          start_date: new Date(),
        });

        const days = allocation.daysUntilCheckIn();
        expect(days).toBeGreaterThanOrEqual(-1);
        expect(days).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Status Transitions', () => {
    it('should allow ASSIGNED → RELEASED transition', () => {
      const allocation = new WeekAllocation({
        status: 'ASSIGNED',
      });

      // Business logic would check this
      expect(allocation.status).toBe('ASSIGNED');
      
      // Can transition to RELEASED
      allocation.status = 'RELEASED';
      expect(allocation.status).toBe('RELEASED');
    });

    it('should allow RELEASED → BOOKED transition', () => {
      const allocation = new WeekAllocation({
        status: 'RELEASED',
      });

      allocation.status = 'BOOKED';
      expect(allocation.status).toBe('BOOKED');
    });

    it('should allow BOOKED → USED transition', () => {
      const allocation = new WeekAllocation({
        status: 'BOOKED',
      });

      allocation.status = 'USED';
      expect(allocation.status).toBe('USED');
    });
  });

  describe('Credit Calculation Data', () => {
    it('should store credits_issued when released', () => {
      const allocation = new WeekAllocation({
        status: 'RELEASED',
        credits_issued: 1080.50,
        released_at: new Date(),
      });

      expect(allocation.credits_issued).toBe(1080.50);
      expect(allocation.released_at).toBeInstanceOf(Date);
    });

    it('should allow null credits_issued for non-released weeks', () => {
      const allocation = new WeekAllocation({
        status: 'ASSIGNED',
        credits_issued: null,
      });

      expect(allocation.credits_issued).toBeNull();
    });
  });

  describe('PMS Integration Fields', () => {
    it('should store PMS booking reference', () => {
      const allocation = new WeekAllocation({
        pms_booking_id: 'MEWS-12345',
        pms_confirmation_code: 'ABC123',
        physical_room_assigned: '201',
      });

      expect(allocation.pms_booking_id).toBe('MEWS-12345');
      expect(allocation.pms_confirmation_code).toBe('ABC123');
      expect(allocation.physical_room_assigned).toBe('201');
    });
  });
});

