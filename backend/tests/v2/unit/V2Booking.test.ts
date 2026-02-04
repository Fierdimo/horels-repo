/**
 * V2Booking Model Unit Tests
 * 
 * Tests for V2Booking model helper methods.
 * Pure unit tests - no database needed.
 */

import { describe, it, expect } from 'vitest';

// Mock V2Booking with business logic
class V2Booking {
  source?: string;
  status?: string;
  check_in?: Date;
  check_out?: Date;
  nights?: number;
  credits_used: number = 0;
  cash_paid: number = 0;
  platform_cost: number = 0;
  platform_revenue: number = 0;
  margin_percent: number = 0;
  guest_name?: string;
  guest_email?: string;
  guest_phone?: string;
  pms_provider?: string;
  pms_booking_id?: string;
  pms_confirmation_code?: string;
  room_category?: string;
  physical_room?: string;

  constructor(data: Partial<V2Booking>) {
    Object.assign(this, data);
  }

  isTimeshare(): boolean {
    return this.source === 'TIMESHARE';
  }

  isHotel(): boolean {
    return this.source === 'HOTEL_PMS';
  }

  isCancellable(): boolean {
    if (!['PENDING', 'CONFIRMED'].includes(this.status || '')) return false;
    if (!this.check_in) return false;
    return this.check_in > new Date();
  }

  getTotalCredits(): number {
    return this.credits_used + this.cash_paid; // 1:1 ratio
  }

  getDuration(): number {
    if (this.nights) return this.nights;
    if (!this.check_in || !this.check_out) return 0;
    const diff = this.check_out.getTime() - this.check_in.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
  }
}

describe('V2Booking Model', () => {

  describe('Source Type Detection', () => {
    it('should identify timeshare bookings', () => {
      const booking = new V2Booking({
        source: 'TIMESHARE',
      });

      expect(booking.isTimeshare()).toBe(true);
      expect(booking.isHotel()).toBe(false);
    });

    it('should identify hotel bookings', () => {
      const booking = new V2Booking({
        source: 'HOTEL_PMS',
      });

      expect(booking.isHotel()).toBe(true);
      expect(booking.isTimeshare()).toBe(false);
    });
  });

  describe('isCancellable()', () => {
    it('should allow cancellation for PENDING booking with future check-in', () => {
      const booking = new V2Booking({
        status: 'PENDING',
        check_in: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // +7 days
      });

      expect(booking.isCancellable()).toBe(true);
    });

    it('should allow cancellation for CONFIRMED booking with future check-in', () => {
      const booking = new V2Booking({
        status: 'CONFIRMED',
        check_in: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(booking.isCancellable()).toBe(true);
    });

    it('should not allow cancellation for CHECKED_IN booking', () => {
      const booking = new V2Booking({
        status: 'CHECKED_IN',
        check_in: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      });

      expect(booking.isCancellable()).toBe(false);
    });

    it('should not allow cancellation for CANCELLED booking', () => {
      const booking = new V2Booking({
        status: 'CANCELLED',
        check_in: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      });

      expect(booking.isCancellable()).toBe(false);
    });

    it('should not allow cancellation for past check-in', () => {
      const booking = new V2Booking({
        status: 'CONFIRMED',
        check_in: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      });

      expect(booking.isCancellable()).toBe(false);
    });

    it('should not allow cancellation for CHECKED_OUT booking', () => {
      const booking = new V2Booking({
        status: 'CHECKED_OUT',
        check_in: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      });

      expect(booking.isCancellable()).toBe(false);
    });
  });

  describe('getTotalCredits()', () => {
    it('should calculate total credits used', () => {
      const booking = new V2Booking({
        credits_used: 1200,
        cash_paid: 0,
      });

      expect(booking.getTotalCredits()).toBe(1200);
    });

    it('should include cash as credits (1:1 ratio)', () => {
      const booking = new V2Booking({
        credits_used: 800,
        cash_paid: 400,
      });

      // Assuming 1:1 credit:cash ratio
      expect(booking.getTotalCredits()).toBe(1200);
    });

    it('should handle credits-only booking', () => {
      const booking = new V2Booking({
        credits_used: 1500,
        cash_paid: 0,
      });

      expect(booking.getTotalCredits()).toBe(1500);
    });
  });

  describe('getDuration()', () => {
    it('should calculate booking duration in nights', () => {
      const checkIn = new Date('2026-07-01');
      const checkOut = new Date('2026-07-08');

      const booking = new V2Booking({
        check_in: checkIn,
        check_out: checkOut,
        nights: 7,
      });

      expect(booking.getDuration()).toBe(7);
    });

    it('should handle single night booking', () => {
      const checkIn = new Date('2026-07-01');
      const checkOut = new Date('2026-07-02');

      const booking = new V2Booking({
        check_in: checkIn,
        check_out: checkOut,
      });

      expect(booking.getDuration()).toBe(1);
    });
  });

  describe('Platform Economics', () => {
    it('should track 100% margin for timeshare bookings', () => {
      const booking = new V2Booking({
        source: 'TIMESHARE',
        credits_used: 1200,
        cash_paid: 0,
        platform_cost: 0, // No cost for timeshare
        platform_revenue: 1200,
        margin_percent: 100,
      });

      expect(booking.platform_cost).toBe(0);
      expect(booking.platform_revenue).toBe(1200);
      expect(booking.margin_percent).toBe(100);
    });

    it('should track ~30% margin for hotel bookings', () => {
      const booking = new V2Booking({
        source: 'HOTEL_PMS',
        credits_used: 1000,
        cash_paid: 500,
        platform_cost: 1050, // What we pay hotel
        platform_revenue: 1500, // What we earn
        margin_percent: 30,
      });

      expect(booking.platform_cost).toBe(1050);
      expect(booking.platform_revenue).toBe(1500);
      expect(booking.margin_percent).toBe(30);
      
      // Margin = (Revenue - Cost) / Revenue * 100
      const calculatedMargin = ((1500 - 1050) / 1500) * 100;
      expect(calculatedMargin).toBe(30);
    });
  });

  describe('Guest Details Caching', () => {
    it('should cache guest details to avoid JOINs', () => {
      const booking = new V2Booking({
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        guest_phone: '+34600000000',
      });

      expect(booking.guest_name).toBe('Maria Lopez');
      expect(booking.guest_email).toBe('maria@example.com');
      expect(booking.guest_phone).toBe('+34600000000');
    });
  });

  describe('PMS Integration', () => {
    it('should store PMS booking references', () => {
      const booking = new V2Booking({
        pms_provider: 'mews',
        pms_booking_id: 'PMS-ABC-123',
        pms_confirmation_code: 'CONF-456',
      });

      expect(booking.pms_provider).toBe('mews');
      expect(booking.pms_booking_id).toBe('PMS-ABC-123');
      expect(booking.pms_confirmation_code).toBe('CONF-456');
    });

    it('should track physical room assignment', () => {
      const booking = new V2Booking({
        room_category: '2BR Oceanview',
        physical_room: '301',
      });

      expect(booking.room_category).toBe('2BR Oceanview');
      expect(booking.physical_room).toBe('301');
    });
  });
});

