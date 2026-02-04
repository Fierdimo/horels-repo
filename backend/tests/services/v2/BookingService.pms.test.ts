/**
 * BookingService PMS Integration Tests
 * 
 * Tests PMS integration in booking creation and cancellation flows.
 */

import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import { BookingService } from '../../../src/services/v2/BookingService';
import { PMSFactory } from '../../../src/services/pms/PMSFactory';
import V2Booking from '../../../src/models/v2/V2Booking';
import TimeshareProperty from '../../../src/models/v2/TimeshareProperty';
import CreditAccount from '../../../src/models/v2/CreditAccount';
import sequelize from '../../../src/config/database';

// Mock PMS Factory
vi.mock('../../../src/services/pms/PMSFactory');

describe('BookingService - PMS Integration', () => {
  let bookingService: BookingService;
  let mockPMSAdapter: any;

  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  beforeEach(async () => {
    // Clear database
    await V2Booking.destroy({ where: {}, force: true });
    await CreditAccount.destroy({ where: {}, force: true });
    await TimeshareProperty.destroy({ where: {}, force: true });

    // Create service
    bookingService = new BookingService();

    // Setup mock PMS adapter
    mockPMSAdapter = {
      getProvider: vi.fn().mockReturnValue('mews'),
      createBooking: vi.fn().mockResolvedValue({
        success: true,
        pmsBookingId: 'PMS-12345',
        pmsConfirmationCode: 'MEWS-67890',
        status: 'CONFIRMED',
        message: 'Booking created in PMS',
      }),
      cancelBooking: vi.fn().mockResolvedValue({
        success: true,
        pmsBookingId: 'PMS-12345',
        status: 'CANCELLED',
        message: 'Booking cancelled in PMS',
      }),
    };

    vi.mocked(PMSFactory.createFromProperty).mockReturnValue(mockPMSAdapter);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('createBooking with PMS', () => {
    it('should create booking and PMS reservation', async () => {
      // Setup test data
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_property_id: 'mews-prop-123',
        pms_credentials: JSON.stringify({
          clientToken: 'test',
          accessToken: 'test',
          serviceId: 'test',
        }),
      } as any);

      const account = await CreditAccount.create({
        user_id: 1,
        balance: 1000,
      } as any);

      // Create booking
      const result = await bookingService.createBooking({
        source: 'HOTEL_PMS',
        guestId: 1,
        guestName: 'Maria Lopez',
        guestEmail: 'maria@example.com',
        guestPhone: '+34600000000',
        propertyId: property.id,
        roomCategory: '2BR Oceanview',
        checkIn: new Date('2026-06-01'),
        checkOut: new Date('2026-06-08'),
        nights: 7,
        guests: 4,
        creditsToUse: 700,
        currency: 'EUR',
      });

      // Verify booking created
      expect(result.booking).toBeDefined();
      expect(result.confirmationCode).toBeDefined();

      // Verify PMS adapter was called
      expect(PMSFactory.createFromProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          id: property.id,
          pms_provider: 'mews',
        })
      );

      expect(mockPMSAdapter.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({
          checkIn: expect.any(Date),
          checkOut: expect.any(Date),
          guest: expect.objectContaining({
            firstName: 'Maria',
            lastName: 'Lopez',
            email: 'maria@example.com',
            phone: '+34600000000',
          }),
          numberOfGuests: 4,
          roomCategory: '2BR Oceanview',
        })
      );

      // Verify booking has PMS details
      const booking = await V2Booking.findByPk(result.booking.id);
      expect(booking?.pms_booking_id).toBe('PMS-12345');
      expect(booking?.pms_confirmation_code).toBe('MEWS-67890');
      expect(booking?.pms_provider).toBe('mews');
      expect(booking?.pms_synced_at).toBeInstanceOf(Date);
    });

    it('should create booking even if PMS fails', async () => {
      // Setup PMS to fail
      mockPMSAdapter.createBooking.mockRejectedValue(new Error('PMS connection failed'));

      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_property_id: 'mews-prop-123',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      await CreditAccount.create({
        user_id: 1,
        balance: 1000,
      } as any);

      // Create booking
      const result = await bookingService.createBooking({
        source: 'HOTEL_PMS',
        guestId: 1,
        guestName: 'Maria Lopez',
        guestEmail: 'maria@example.com',
        propertyId: property.id,
        roomCategory: '2BR Oceanview',
        checkIn: new Date('2026-06-01'),
        checkOut: new Date('2026-06-08'),
        nights: 7,
        guests: 4,
        creditsToUse: 700,
      });

      // Booking should still be created
      expect(result.booking).toBeDefined();

      // PMS fields should be null or indicate failure
      const booking = await V2Booking.findByPk(result.booking.id);
      expect(booking?.pms_booking_id).toBeNull();
      expect(booking?.pms_synced_at).toBeNull(); // Indicates sync failure
    });

    it('should skip PMS if property has no PMS provider', async () => {
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: null, // No PMS
      } as any);

      await CreditAccount.create({
        user_id: 1,
        balance: 1000,
      } as any);

      const result = await bookingService.createBooking({
        source: 'HOTEL_PMS',
        guestId: 1,
        guestName: 'Maria Lopez',
        guestEmail: 'maria@example.com',
        propertyId: property.id,
        roomCategory: '2BR Oceanview',
        checkIn: new Date('2026-06-01'),
        checkOut: new Date('2026-06-08'),
        nights: 7,
        guests: 4,
        creditsToUse: 700,
      });

      // Booking created
      expect(result.booking).toBeDefined();

      // PMS adapter not called
      expect(PMSFactory.createFromProperty).not.toHaveBeenCalled();

      // No PMS details
      const booking = await V2Booking.findByPk(result.booking.id);
      expect(booking?.pms_booking_id).toBeNull();
      expect(booking?.pms_provider).toBeNull();
    });
  });

  describe('cancelBooking with PMS', () => {
    it('should cancel booking and PMS reservation', async () => {
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

      // Setup credit account
      const account = await CreditAccount.create({
        user_id: 1,
        balance: 300,
      } as any);

      // Create booking with PMS details
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
        currency: 'EUR',
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: 'PMS-12345',
        pms_provider: 'mews',
        pms_synced_at: new Date(),
      } as any);

      // Cancel booking
      const result = await bookingService.cancelBooking(booking.id, 1, 'Guest request');

      // Verify cancellation
      expect(result.status).toBe('CANCELLED');
      expect(result.cancelled_at).toBeInstanceOf(Date);

      // Verify PMS cancel was called
      expect(mockPMSAdapter.cancelBooking).toHaveBeenCalledWith({
        pmsBookingId: 'PMS-12345',
        reason: 'Guest request',
      });

      // Verify credits refunded
      const updatedAccount = await CreditAccount.findByPk(account.id);
      expect(updatedAccount?.balance).toBe(1000); // 300 + 700
    });

    it('should cancel booking even if PMS cancellation fails', async () => {
      // Setup PMS to fail
      mockPMSAdapter.cancelBooking.mockRejectedValue(new Error('PMS cancellation failed'));

      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
        pms_provider: 'mews',
        pms_property_id: 'mews-prop-123',
        pms_credentials: JSON.stringify({ test: 'test' }),
      } as any);

      await CreditAccount.create({
        user_id: 1,
        balance: 300,
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
        currency: 'EUR',
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: 'PMS-12345',
        pms_provider: 'mews',
      } as any);

      // Cancel should still succeed
      const result = await bookingService.cancelBooking(booking.id, 1);

      expect(result.status).toBe('CANCELLED');
      expect(mockPMSAdapter.cancelBooking).toHaveBeenCalled();
    });

    it('should skip PMS cancellation if no pms_booking_id', async () => {
      const property = await TimeshareProperty.create({
        name: 'Test Resort',
        city: 'Marbella',
        region: 'Andalusia',
        country: 'Spain',
      } as any);

      await CreditAccount.create({
        user_id: 1,
        balance: 300,
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
        currency: 'EUR',
        platform_cost: 500,
        platform_revenue: 700,
        margin_percent: 28.57,
        status: 'CONFIRMED',
        pms_booking_id: null, // No PMS booking
      } as any);

      const result = await bookingService.cancelBooking(booking.id, 1);

      expect(result.status).toBe('CANCELLED');
      expect(mockPMSAdapter.cancelBooking).not.toHaveBeenCalled();
    });
  });
});
