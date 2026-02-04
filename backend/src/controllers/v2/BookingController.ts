/**
 * BookingController (V2)
 * 
 * Handles booking endpoints for timeshare and hotel reservations.
 * 
 * Endpoints:
 * - POST /api/v2/bookings - Create booking
 * - GET /api/v2/bookings/:id - Get booking details
 * - DELETE /api/v2/bookings/:id - Cancel booking
 * - GET /api/v2/bookings - Get user's bookings
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Phase 5
 */

import { Response } from 'express';
import { AuthRequest } from '../../middleware/authMiddleware';
import { BookingService, BookingRequest } from '../../services/v2/BookingService';

export class BookingController {
  /**
   * POST /api/v2/bookings
   * 
   * Create a new booking
   */
  static async createBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const {
        source,
        weekAllocationId,
        propertyId,
        roomCategory,
        guestName,
        guestEmail,
        guestPhone,
        checkIn,
        checkOut,
        nights,
        guests,
        creditsToUse,
        cashAmount,
        currency,
        specialRequests,
      } = req.body;

      // Validate required fields
      if (!source || !['TIMESHARE', 'HOTEL_PMS'].includes(source)) {
        res.status(400).json({
          error: 'source is required and must be TIMESHARE or HOTEL_PMS',
        });
        return;
      }

      if (!guestName || !guestEmail) {
        res.status(400).json({
          error: 'guestName and guestEmail are required',
        });
        return;
      }

      if (!checkIn || !checkOut) {
        res.status(400).json({
          error: 'checkIn and checkOut are required',
        });
        return;
      }

      if (!guests || guests < 1) {
        res.status(400).json({
          error: 'guests is required and must be at least 1',
        });
        return;
      }

      if (!creditsToUse || creditsToUse <= 0) {
        res.status(400).json({
          error: 'creditsToUse is required and must be greater than 0',
        });
        return;
      }

      // Source-specific validation
      if (source === 'TIMESHARE' && !weekAllocationId) {
        res.status(400).json({
          error: 'weekAllocationId is required for timeshare bookings',
        });
        return;
      }

      if (source === 'HOTEL_PMS' && (!propertyId || !roomCategory)) {
        res.status(400).json({
          error: 'propertyId and roomCategory are required for hotel bookings',
        });
        return;
      }

      // Parse dates
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
        res.status(400).json({
          error: 'Invalid date format. Use ISO 8601 (YYYY-MM-DD)',
        });
        return;
      }

      // Build request
      const bookingRequest: BookingRequest = {
        source,
        weekAllocationId: weekAllocationId ? parseInt(weekAllocationId, 10) : undefined,
        propertyId: propertyId ? parseInt(propertyId, 10) : undefined,
        roomCategory,
        guestId: req.user!.id,
        guestName,
        guestEmail,
        guestPhone,
        checkIn: checkInDate,
        checkOut: checkOutDate,
        nights: parseInt(nights, 10),
        guests: parseInt(guests, 10),
        creditsToUse: parseFloat(creditsToUse),
        cashAmount: cashAmount ? parseFloat(cashAmount) : undefined,
        currency: currency || 'EUR',
        specialRequests,
      };

      // Create booking
      const bookingService = new BookingService();
      const result = await bookingService.createBooking(bookingRequest);

      res.status(201).json({
        success: true,
        data: {
          bookingId: result.booking.id,
          confirmationCode: result.confirmationCode,
          status: result.booking.status,
          property: {
            id: result.booking.property_id,
          },
          roomCategory: result.booking.room_category,
          checkIn: result.booking.check_in,
          checkOut: result.booking.check_out,
          guests: result.booking.number_of_guests,
          payment: {
            creditsUsed: result.booking.credits_used,
            cashPaid: result.booking.cash_paid,
          },
          weekAllocation: result.weekAllocation
            ? {
                id: result.weekAllocation.id,
                status: result.weekAllocation.status,
              }
            : null,
        },
      });
    } catch (error: any) {
      console.error('[BookingController] Create booking error:', error);
      res.status(500).json({
        error: 'Failed to create booking',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/bookings/:id
   * 
   * Get booking details
   */
  static async getBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id || isNaN(parseInt(id, 10))) {
        res.status(400).json({
          error: 'Invalid booking ID',
        });
        return;
      }

      const bookingService = new BookingService();
      const booking = await bookingService.getBooking(
        parseInt(id, 10),
        req.user!.id
      );

      res.status(200).json({
        success: true,
        data: {
          id: booking.id,
          confirmationCode: booking.confirmation_code,
          status: booking.status,
          source: booking.source,
          property: booking.property
            ? {
                id: booking.property.id,
                name: booking.property.name,
                location: `${booking.property.city}, ${booking.property.region}, ${booking.property.country}`,
              }
            : null,
          roomCategory: booking.room_category,
          physicalRoom: booking.physical_room,
          checkIn: booking.check_in,
          checkOut: booking.check_out,
          nights: booking.nights,
          guests: booking.number_of_guests,
          payment: {
            creditsUsed: booking.credits_used,
            cashPaid: booking.cash_paid,
            currency: booking.currency,
          },
          specialRequests: booking.special_requests,
          cancelledAt: booking.cancelled_at,
          cancellationReason: booking.cancellation_reason,
          pms: {
            bookingId: booking.pms_booking_id,
            provider: booking.pms_provider,
            status: booking.pms_status,
            lastSync: booking.pms_last_sync,
          },
          createdAt: booking.created_at,
        },
      });
    } catch (error: any) {
      console.error('[BookingController] Get booking error:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'Booking not found',
        });
        return;
      }

      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: 'Unauthorized',
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to get booking',
        details: error.message,
      });
    }
  }

  /**
   * DELETE /api/v2/bookings/:id
   * 
   * Cancel booking
   */
  static async cancelBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;

      if (!id || isNaN(parseInt(id, 10))) {
        res.status(400).json({
          error: 'Invalid booking ID',
        });
        return;
      }

      const bookingService = new BookingService();
      const booking = await bookingService.cancelBooking(
        parseInt(id, 10),
        req.user!.id,
        reason
      );

      res.status(200).json({
        success: true,
        data: {
          bookingId: booking.id,
          confirmationCode: booking.confirmation_code,
          status: booking.status,
          cancelledAt: booking.cancelled_at,
          cancellationReason: booking.cancellation_reason,
          refundedCredits: booking.credits_used,
        },
      });
    } catch (error: any) {
      console.error('[BookingController] Cancel booking error:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          error: 'Booking not found',
        });
        return;
      }

      if (error.message.includes('Unauthorized')) {
        res.status(403).json({
          error: 'Unauthorized',
        });
        return;
      }

      if (error.message.includes('already cancelled') || error.message.includes('Cannot cancel')) {
        res.status(400).json({
          error: error.message,
        });
        return;
      }

      res.status(500).json({
        error: 'Failed to cancel booking',
        details: error.message,
      });
    }
  }

  /**
   * GET /api/v2/bookings
   * 
   * Get user's bookings
   */
  static async getUserBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { status, upcoming, page = '1', limit = '20' } = req.query;

      const bookingService = new BookingService();
      const result = await bookingService.getUserBookings(req.user!.id, {
        status: status as string,
        upcoming: upcoming === 'true',
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10),
      });

      res.status(200).json({
        success: true,
        data: {
          bookings: result.bookings.map((booking) => ({
            id: booking.id,
            confirmationCode: booking.confirmation_code,
            status: booking.status,
            source: booking.source,
            property: booking.property
              ? {
                  id: booking.property.id,
                  name: booking.property.name,
                  location: `${booking.property.city}, ${booking.property.region}, ${booking.property.country}`,
                }
              : null,
            roomCategory: booking.room_category,
            checkIn: booking.check_in,
            checkOut: booking.check_out,
            nights: booking.nights,
            guests: booking.number_of_guests,
            creditsUsed: booking.credits_used,
            cancelledAt: booking.cancelled_at,
          })),
          meta: {
            total: result.total,
            page: result.page,
            limit: parseInt(limit as string, 10),
            totalPages: result.totalPages,
          },
        },
      });
    } catch (error: any) {
      console.error('[BookingController] Get user bookings error:', error);
      res.status(500).json({
        error: 'Failed to get bookings',
        details: error.message,
      });
    }
  }
}
