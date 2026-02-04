/**
 * Booking Routes (V2)
 * 
 * Endpoints for booking management
 */

import { Router } from 'express';
import { BookingController } from '../../controllers/v2/BookingController';

const router = Router();

/**
 * POST /api/v2/bookings
 * 
 * Create a new booking
 * 
 * Body:
 * - source: 'TIMESHARE' | 'HOTEL_PMS'
 * - weekAllocationId?: number (required if TIMESHARE)
 * - propertyId?: number (required if HOTEL_PMS)
 * - roomCategory?: string (required if HOTEL_PMS)
 * - guestName: string
 * - guestEmail: string
 * - guestPhone?: string
 * - checkIn: string (ISO date)
 * - checkOut: string (ISO date)
 * - nights: number
 * - guests: number
 * - creditsToUse: number
 * - cashAmount?: number
 * - currency?: string
 * - specialRequests?: string
 */
router.post('/', BookingController.createBooking);

/**
 * GET /api/v2/bookings
 * 
 * Get user's bookings
 * 
 * Query:
 * - status?: string (PENDING, CONFIRMED, CANCELLED, etc.)
 * - upcoming?: boolean (only future bookings)
 * - page?: number (default: 1)
 * - limit?: number (default: 20)
 */
router.get('/', BookingController.getUserBookings);

/**
 * GET /api/v2/bookings/:id
 * 
 * Get booking details
 */
router.get('/:id', BookingController.getBooking);

/**
 * DELETE /api/v2/bookings/:id
 * 
 * Cancel booking
 * 
 * Body:
 * - reason?: string (cancellation reason)
 */
router.delete('/:id', BookingController.cancelBooking);

export default router;
