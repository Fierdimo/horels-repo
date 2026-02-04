/**
 * PMSSyncService Unit Tests
 * 
 * Tests background synchronization service for PMS bookings.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import PMSSyncService from '../../../src/services/v2/PMSSyncService';
import { PMSFactory } from '../../../src/services/pms/PMSFactory';
import V2Booking from '../../../src/models/v2/V2Booking';
import TimeshareProperty from '../../../src/models/v2/TimeshareProperty';
import sequelize from '../../../src/config/database';

// Mock PMS Factory
vi.mock('../../../src/services/pms/PMSFactory');

describe('PMSSyncService', () => {
  let syncService: PMSSyncService;
  let mockPMSAdapter: any;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clear database
    await V2Booking.destroy({ where: {}, force: true });
    await TimeshareProperty.destroy({ where: {}, force: true });

    // Create service
    syncService = new PMSSyncService();

    // Setup mock PMS adapter
    mockPMSAdapter = {
      getProvider: vi.fn().mockReturnValue('mews'),
      getBookingStatus: vi.fn().mockResolvedValue({
        pmsBookingId: 'PMS-12345',
        status: 'CHECKED_IN',
        checkIn: new Date('2026-06-01'),
        checkOut: new Date('2026-06-08'),
        roomAssigned: 'ROOM-201',
        lastUpdated: new Date(),
      }),
      createBooking: vi.fn().mockResolvedValue({
        success: true,
        pmsBookingId: 'PMS-NEW-123',
        pmsConfirmationCode: 'MEWS-NEW-456',
        status: 'CONFIRMED',
      }),
    };

    vi.mocked(PMSFactory.createFromProperty).mockReturnValue(mockPMSAdapter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('syncBooking', () => {
    it('should sync booking status successfully', async () => {
      // Setup property
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_property_id: 'mews-prop-123',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      // Create booking
      const booking = await V2Booking.create({
        booking_code: 'TEST-001',
        guest_id: 1,
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        property_id: property.id,
        check_in: new Date('2026-06-01'),
        check_out: new Date('2026-06-08'),
        nights: 7,
        number_of_guests: 4,
        room_category: '2BR Oceanview',
        source: 'HOTEL_PMS',
        credits_used: 700,
        cash_paid: 0,
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: 'PMS-12345',
        pms_provider: 'mews',
      } as any);

      // Sync booking
      const result = await syncService.syncBooking(booking.id);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(true);
      expect(result.changes).toEqual({
        status: 'CHECKED_IN',
        roomAssigned: 'ROOM-201',
      });

      // Verify booking updated
      const updatedBooking = await V2Booking.findByPk(booking.id);
      expect(updatedBooking?.status).toBe('CHECKED_IN');
      expect(updatedBooking?.physical_room).toBe('ROOM-201');
      expect(updatedBooking?.pms_synced_at).toBeInstanceOf(Date);
    });

    it('should skip sync if booking not found', async () => {
      const result = await syncService.syncBooking(99999);

      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toBe('Booking not found');
    });

    it('should skip sync if no PMS integration', async () => {
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
      } as any);

      const booking = await V2Booking.create({
        booking_code: 'TEST-001',
        guest_id: 1,
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        property_id: property.id,
        check_in: new Date('2026-06-01'),
        check_out: new Date('2026-06-08'),
        nights: 7,
        number_of_guests: 4,
        room_category: '2BR Oceanview',
        source: 'TIMESHARE',
        credits_used: 700,
        cash_paid: 0,
        platform_cost: 0,
        platform_revenue: 700,
        margin_percent: 100,
        status: 'CONFIRMED',
        pms_booking_id: null, // No PMS
      } as any);

      const result = await syncService.syncBooking(booking.id);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.error).toBe('No PMS integration configured');
    });

    it('should skip sync if booking already checked out', async () => {
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
      } as any);

      const booking = await V2Booking.create({
        booking_code: 'TEST-001',
        guest_id: 1,
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        property_id: property.id,
        check_in: new Date('2026-06-01'),
        check_out: new Date('2026-06-08'),
        nights: 7,
        number_of_guests: 4,
        room_category: '2BR Oceanview',
        source: 'HOTEL_PMS',
        credits_used: 700,
        cash_paid: 0,
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CHECKED_OUT',
        pms_booking_id: 'PMS-12345',
        pms_provider: 'mews',
      } as any);

      const result = await syncService.syncBooking(booking.id);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.error).toBe('Booking is in final state');
      expect(mockPMSAdapter.getBookingStatus).not.toHaveBeenCalled();
    });

    it('should handle sync errors gracefully', async () => {
      mockPMSAdapter.getBookingStatus.mockRejectedValue(new Error('PMS API error'));

      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      const booking = await V2Booking.create({
        booking_code: 'TEST-001',
        guest_id: 1,
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        property_id: property.id,
        check_in: new Date('2026-06-01'),
        check_out: new Date('2026-06-08'),
        nights: 7,
        number_of_guests: 4,
        room_category: '2BR Oceanview',
        source: 'HOTEL_PMS',
        credits_used: 700,
        cash_paid: 0,
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: 'PMS-12345',
        pms_provider: 'mews',
      } as any);

      const result = await syncService.syncBooking(booking.id);

      expect(result.success).toBe(false);
      expect(result.updated).toBe(false);
      expect(result.error).toContain('PMS API error');
    });

    it('should not update if no changes detected', async () => {
      mockPMSAdapter.getBookingStatus.mockResolvedValue({
        pmsBookingId: 'PMS-12345',
        status: 'CONFIRMED', // Same status
        checkIn: new Date('2026-06-01'),
        checkOut: new Date('2026-06-08'),
        roomAssigned: null, // No room assigned yet
      });

      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      const booking = await V2Booking.create({
        booking_code: 'TEST-001',
        guest_id: 1,
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        property_id: property.id,
        check_in: new Date('2026-06-01'),
        check_out: new Date('2026-06-08'),
        nights: 7,
        number_of_guests: 4,
        room_category: '2BR Oceanview',
        source: 'HOTEL_PMS',
        credits_used: 700,
        cash_paid: 0,
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: 'PMS-12345',
        pms_provider: 'mews',
        physical_room: null,
      } as any);

      const result = await syncService.syncBooking(booking.id);

      expect(result.success).toBe(true);
      expect(result.updated).toBe(false);
      expect(result.changes).toBeUndefined();
    });
  });

  describe('syncPendingBookings', () => {
    it('should sync multiple bookings', async () => {
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      // Create 3 bookings
      for (let i = 1; i <= 3; i++) {
        await V2Booking.create({
          booking_code: `TEST-00${i}`,
          guest_id: 1,
          guest_name: 'Maria Lopez',
          guest_email: 'maria@example.com',
          property_id: property.id,
          check_in: new Date('2026-06-01'),
          check_out: new Date('2026-06-08'),
          nights: 7,
          number_of_guests: 4,
          room_category: '2BR Oceanview',
          source: 'HOTEL_PMS',
          credits_used: 700,
          cash_paid: 0,
          platform_cost: 500,
          platform_revenue: 700,
          margin_percent: 28.57,
          status: 'CONFIRMED',
          pms_booking_id: `PMS-${i}`,
          pms_provider: 'mews',
          pms_synced_at: new Date(Date.now() - 3 * 60 * 60 * 1000), // 3 hours ago
        } as any);
      }

      const results = await syncService.syncPendingBookings(2);

      expect(results).toHaveLength(3);
      expect(results.filter((r) => r.success)).toHaveLength(3);
    });

    it('should skip recently synced bookings', async () => {
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      // Create booking synced 1 hour ago
      await V2Booking.create({
        booking_code: 'TEST-001',
        guest_id: 1,
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        property_id: property.id,
        check_in: new Date('2026-06-01'),
        check_out: new Date('2026-06-08'),
        nights: 7,
        number_of_guests: 4,
        room_category: '2BR Oceanview',
        source: 'HOTEL_PMS',
        credits_used: 700,
        cash_paid: 0,
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: 'PMS-1',
        pms_provider: 'mews',
        pms_synced_at: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      } as any);

      const results = await syncService.syncPendingBookings(2);

      expect(results).toHaveLength(0); // Should not sync
    });
  });

  describe('syncPropertyBookings', () => {
    it('should sync all bookings for a property', async () => {
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      // Create bookings for this property
      for (let i = 1; i <= 2; i++) {
        await V2Booking.create({
          booking_code: `TEST-00${i}`,
          guest_id: 1,
          guest_name: 'Maria Lopez',
          guest_email: 'maria@example.com',
          property_id: property.id,
          check_in: new Date('2026-06-01'),
          check_out: new Date('2026-06-08'),
          nights: 7,
          number_of_guests: 4,
          room_category: '2BR Oceanview',
          source: 'HOTEL_PMS',
          credits_used: 700,
          cash_paid: 0,
          platform_cost: 500,
          platform_revenue: 700,
          margin_percent: 28.57,
          status: 'CONFIRMED',
          pms_booking_id: `PMS-${i}`,
          pms_provider: 'mews',
        } as any);
      }

      const results = await syncService.syncPropertyBookings(property.id);

      expect(results).toHaveLength(2);
      expect(results.filter((r) => r.success)).toHaveLength(2);
    });
  });

  describe('retryFailedOperations', () => {
    it('should retry failed PMS booking creations', async () => {
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      // Create booking without PMS ID (failed creation)
      const booking = await V2Booking.create({
        booking_code: 'TEST-001',
        guest_id: 1,
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        property_id: property.id,
        check_in: new Date('2026-06-01'),
        check_out: new Date('2026-06-08'),
        nights: 7,
        number_of_guests: 4,
        room_category: '2BR Oceanview',
        source: 'HOTEL_PMS',
        credits_used: 700,
        cash_paid: 0,
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: null, // Failed to create in PMS
        pms_provider: 'mews',
      } as any);

      const results = await syncService.retryFailedOperations();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);

      // Verify PMS booking created
      expect(mockPMSAdapter.createBooking).toHaveBeenCalled();

      // Verify booking updated
      const updatedBooking = await V2Booking.findByPk(booking.id);
      expect(updatedBooking?.pms_booking_id).toBe('PMS-NEW-123');
      expect(updatedBooking?.pms_synced_at).toBeInstanceOf(Date);
    });

    it('should handle retry failures', async () => {
      mockPMSAdapter.createBooking.mockRejectedValue(new Error('Still failing'));

      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      await V2Booking.create({
        booking_code: 'TEST-001',
        guest_id: 1,
        guest_name: 'Maria Lopez',
        guest_email: 'maria@example.com',
        property_id: property.id,
        check_in: new Date('2026-06-01'),
        check_out: new Date('2026-06-08'),
        nights: 7,
        number_of_guests: 4,
        room_category: '2BR Oceanview',
        source: 'HOTEL_PMS',
        credits_used: 700,
        cash_paid: 0,
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: null,
        pms_provider: 'mews',
      } as any);

      const results = await syncService.retryFailedOperations();

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].error).toContain('Still failing');
    });
  });
});
