/**
 * BookingService (V2)
 * 
 * Handles booking creation for both timeshare and hotel sources.
 * Coordinates credit deduction, PMS integration, and week allocation updates.
 * 
 * Architecture:
 * 1. Validate booking request
 * 2. Check credit balance
 * 3. Create V2Booking record
 * 4. Deduct credits from account
 * 5. Update week_allocation status (if timeshare)
 * 6. Create PMS reservation (if needed)
 * 7. Rollback on failure
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Phase 5
 */

import { Transaction } from 'sequelize';
import V2Booking from '../../models/v2/V2Booking';
import WeekAllocation from '../../models/v2/WeekAllocation';
import CreditAccount from '../../models/v2/CreditAccount';
import CreditTransaction from '../../models/v2/CreditTransaction';
import TimeshareProperty from '../../models/v2/TimeshareProperty';
import User from '../../models/User';
import sequelize from '../../config/database';
import { PMSFactory } from '../pms/PMSFactory';
import { PMSBookingRequest } from '../pms/PMSAdapter';

/**
 * Booking request details
 */
export interface BookingRequest {
  // Source identification
  source: 'TIMESHARE' | 'HOTEL_PMS';
  weekAllocationId?: number; // Required if source = TIMESHARE
  propertyId?: number; // Required if source = HOTEL_PMS
  roomCategory?: string; // Required if source = HOTEL_PMS

  // Guest information
  guestId: number;
  guestName: string;
  guestEmail: string;
  guestPhone?: string;

  // Stay details
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guests: number;

  // Payment
  creditsToUse: number;
  cashAmount?: number; // For hotel bookings with mixed payment
  currency?: string;

  // Additional
  specialRequests?: string;
}

/**
 * Booking result
 */
export interface BookingResult {
  booking: V2Booking;
  confirmationCode: string;
  creditTransaction?: CreditTransaction;
  pmsBookingId?: string;
  weekAllocation?: WeekAllocation;
}

/**
 * BookingService
 * 
 * Handles booking creation with transactional integrity.
 */
export class BookingService {
  /**
   * Create a new booking
   * 
   * @param request - Booking request details
   * @returns Booking result with confirmation
   */
  async createBooking(request: BookingRequest): Promise<BookingResult> {
    // Use transaction for atomicity
    const transaction = await sequelize.transaction();

    try {
      // 1. Validate request
      await this.validateBookingRequest(request, transaction);

      // 2. Check credit balance
      const creditAccount = await this.getCreditAccount(request.guestId, transaction);
      if (creditAccount.balance < request.creditsToUse) {
        throw new Error(
          `Insufficient credits. Balance: ${creditAccount.balance}, Required: ${request.creditsToUse}`
        );
      }

      // 3. Get property details
      let propertyId: number;
      let roomCategory: string;
      let weekAllocation: WeekAllocation | null = null;

      if (request.source === 'TIMESHARE') {
        // Load week allocation
        weekAllocation = await WeekAllocation.findByPk(request.weekAllocationId!, {
          include: [
            {
              association: 'ownership',
              required: true,
              include: [
                {
                  association: 'unit',
                  required: true,
                  include: [{ association: 'property', required: true }],
                },
              ],
            },
          ],
          transaction,
        });

        if (!weekAllocation) {
          throw new Error(`Week allocation ${request.weekAllocationId} not found`);
        }

        if (weekAllocation.status !== 'RELEASED') {
          throw new Error(
            `Week allocation is not available (status: ${weekAllocation.status})`
          );
        }

        const ownership = weekAllocation.ownership as any;
        const unit = ownership.unit;
        const property = unit.property;

        propertyId = property.id;
        roomCategory = unit.category || unit.name;
      } else {
        // Hotel booking
        if (!request.propertyId || !request.roomCategory) {
          throw new Error('propertyId and roomCategory are required for hotel bookings');
        }
        propertyId = request.propertyId;
        roomCategory = request.roomCategory;
      }

      // 4. Generate confirmation code
      const confirmationCode = this.generateConfirmationCode(propertyId);

      // 5. Calculate platform economics
      const platformCost =
        request.source === 'HOTEL_PMS' && request.cashAmount
          ? request.cashAmount
          : 0;
      const platformRevenue = request.creditsToUse;
      const marginPercent =
        platformCost > 0
          ? ((platformRevenue - platformCost) / platformRevenue) * 100
          : 100;

      // 6. Create booking record
      const booking = await V2Booking.create(
        {
          confirmation_code: confirmationCode,
          guest_id: request.guestId,
          guest_name: request.guestName,
          guest_email: request.guestEmail,
          guest_phone: request.guestPhone || null,
          property_id: propertyId,
          check_in: request.checkIn,
          check_out: request.checkOut,
          nights: request.nights,
          guests: request.guests,
          room_category: roomCategory,
          source: request.source,
          week_allocation_id:
            request.source === 'TIMESHARE' ? request.weekAllocationId : null,
          credits_used: request.creditsToUse,
          cash_paid: request.cashAmount || 0,
          currency: request.currency || 'EUR',
          payment_status: 'COMPLETED',
          platform_cost: platformCost,
          platform_revenue: platformRevenue,
          margin_percent: marginPercent,
          status: 'CONFIRMED',
          confirmed_at: new Date(),
          special_requests: request.specialRequests || null,
        },
        { transaction }
      );

      // 7. Deduct credits
      const creditTransaction = await this.deductCredits(
        creditAccount.id,
        request.creditsToUse,
        creditAccount.balance,
        booking.id,
        transaction
      );

      // 8. Update credit account balance
      await creditAccount.update(
        {
          balance: creditAccount.balance - request.creditsToUse,
          last_transaction_at: new Date(),
        },
        { transaction }
      );

      // 9. Update week allocation (if timeshare)
      if (request.source === 'TIMESHARE' && weekAllocation) {
        await weekAllocation.update(
          {
            status: 'BOOKED',
            booking_id: booking.id,
            booked_by: request.guestId,
            booked_at: new Date(),
          },
          { transaction }
        );
      }

      // 10. Create PMS reservation (Phase 6)
      const property = await TimeshareProperty.findByPk(propertyId, { transaction });
      if (property && property.pms_provider) {
        try {
          const adapter = PMSFactory.createFromProperty(property);
          
          // Prepare guest info
          const nameParts = request.guestName.split(' ');
          const firstName = nameParts[0] || request.guestName;
          const lastName = nameParts.slice(1).join(' ') || request.guestName;
          
          // Build PMS booking request
          const pmsRequest: PMSBookingRequest = {
            checkIn: request.checkIn,
            checkOut: request.checkOut,
            guest: {
              firstName,
              lastName,
              email: request.guestEmail,
              phone: request.guestPhone || undefined,
            },
            numberOfGuests: request.guests,
            roomCategory,
            specialRequests: request.specialRequests || undefined,
            internalBookingId: booking.id,
            internalConfirmationCode: confirmationCode,
          };

          // Create booking in PMS
          const pmsResponse = await adapter.createBooking(pmsRequest);
          
          // Update booking with PMS details
          if (pmsResponse.success && pmsResponse.pmsBookingId) {
            await booking.update(
              {
                pms_booking_id: pmsResponse.pmsBookingId,
                pms_confirmation_code: pmsResponse.pmsConfirmationCode || null,
                pms_provider: property.pms_provider,
                pms_synced_at: new Date(),
              },
              { transaction }
            );
            
            console.log(
              `[BookingService] PMS booking created: ${pmsResponse.pmsBookingId} for booking ${booking.id}`
            );
          }
        } catch (pmsError: any) {
          // Log PMS error but don't fail the entire booking
          // The booking is still valid in our system
          console.error('[BookingService] PMS booking failed:', {
            bookingId: booking.id,
            propertyId,
            provider: property.pms_provider,
            error: pmsError.message,
          });
          
          // Mark booking as needing manual PMS sync
          await booking.update(
            {
              pms_provider: property.pms_provider,
              pms_synced_at: null, // null indicates sync failure
            },
            { transaction }
          );
        }
      }

      // Commit transaction
      await transaction.commit();

      return {
        booking,
        confirmationCode,
        creditTransaction,
        weekAllocation: weekAllocation || undefined,
      };
    } catch (error) {
      // Rollback on error
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get booking by ID
   * 
   * @param bookingId - Booking ID
   * @param userId - User ID (for authorization)
   * @returns Booking with details
   */
  async getBooking(bookingId: number, userId: number): Promise<V2Booking> {
    const booking = await V2Booking.findByPk(bookingId, {
      include: [
        {
          model: TimeshareProperty,
          as: 'property',
          attributes: ['id', 'name', 'city', 'region', 'country'],
        },
        {
          model: WeekAllocation,
          as: 'weekAllocation',
          attributes: ['id', 'start_date', 'end_date', 'status'],
        },
      ],
    });

    if (!booking) {
      throw new Error(`Booking ${bookingId} not found`);
    }

    // Authorization: user can only view their own bookings
    if (booking.guest_id !== userId) {
      throw new Error('Unauthorized: You can only view your own bookings');
    }

    return booking;
  }

  /**
   * Cancel booking
   * 
   * @param bookingId - Booking ID
   * @param userId - User ID (for authorization)
   * @param reason - Cancellation reason
   * @returns Updated booking
   */
  async cancelBooking(
    bookingId: number,
    userId: number,
    reason?: string
  ): Promise<V2Booking> {
    const transaction = await sequelize.transaction();

    try {
      // Load booking
      const booking = await V2Booking.findByPk(bookingId, {
        include: [
          {
            model: WeekAllocation,
            as: 'weekAllocation',
          },
        ],
        transaction,
      });

      if (!booking) {
        throw new Error(`Booking ${bookingId} not found`);
      }

      // Authorization
      if (booking.guest_id !== userId) {
        throw new Error('Unauthorized: You can only cancel your own bookings');
      }

      // Validate status
      if (booking.status === 'CANCELLED') {
        throw new Error('Booking is already cancelled');
      }

      if (booking.status === 'CHECKED_OUT') {
        throw new Error('Cannot cancel a completed booking');
      }

      // 1. Update booking status
      await booking.update(
        {
          status: 'CANCELLED',
          cancelled_at: new Date(),
          cancellation_reason: reason || null,
        },
        { transaction }
      );

      // 2. Refund credits
      const creditAccount = await this.getCreditAccount(userId, transaction);
      await this.refundCredits(
        creditAccount.id,
        booking.credits_used,
        creditAccount.balance,
        booking.id,
        transaction
      );

      await creditAccount.update(
        {
          balance: creditAccount.balance + booking.credits_used,
          last_transaction_at: new Date(),
        },
        { transaction }
      );

      // 3. Release week allocation (if timeshare)
      if (booking.source === 'TIMESHARE' && booking.weekAllocation) {
        await booking.weekAllocation.update(
          {
            status: 'RELEASED', // Back to available
            booking_id: null,
            booked_by: null,
            booked_at: null,
          },
          { transaction }
        );
      }

      // 4. Cancel PMS reservation (Phase 6)
      if (booking.pms_booking_id && booking.pms_provider) {
        try {
          const property = await TimeshareProperty.findByPk(booking.property_id, {
            transaction,
          });
          
          if (property && property.pms_provider) {
            const adapter = PMSFactory.createFromProperty(property);
            
            await adapter.cancelBooking({
              pmsBookingId: booking.pms_booking_id,
              reason: reason || 'Guest cancellation',
            });
            
            console.log(
              `[BookingService] PMS booking cancelled: ${booking.pms_booking_id} for booking ${booking.id}`
            );
          }
        } catch (pmsError: any) {
          // Log PMS error but don't fail the entire cancellation
          // The booking is still cancelled in our system
          console.error('[BookingService] PMS cancellation failed:', {
            bookingId: booking.id,
            pmsBookingId: booking.pms_booking_id,
            provider: booking.pms_provider,
            error: pmsError.message,
          });
          
          // Mark as needing manual PMS cancellation
          // Staff will need to manually cancel in PMS dashboard
        }
      }

      await transaction.commit();

      return booking;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get user's bookings
   * 
   * @param userId - User ID
   * @param filters - Optional filters
   * @returns List of bookings
   */
  async getUserBookings(
    userId: number,
    filters?: {
      status?: string;
      upcoming?: boolean;
      page?: number;
      limit?: number;
    }
  ): Promise<{ bookings: V2Booking[]; total: number; page: number; totalPages: number }> {
    const page = filters?.page || 1;
    const limit = filters?.limit || 20;
    const offset = (page - 1) * limit;

    const where: any = { guest_id: userId };

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.upcoming) {
      where.check_in = { [require('sequelize').Op.gte]: new Date() };
    }

    const { count, rows } = await V2Booking.findAndCountAll({
      where,
      include: [
        {
          model: TimeshareProperty,
          as: 'property',
          attributes: ['id', 'name', 'city', 'region', 'country', 'images'],
        },
      ],
      order: [['check_in', 'DESC']],
      limit,
      offset,
    });

    return {
      bookings: rows,
      total: count,
      page,
      totalPages: Math.ceil(count / limit),
    };
  }

  // ==================== PRIVATE METHODS ====================

  /**
   * Validate booking request
   */
  private async validateBookingRequest(
    request: BookingRequest,
    transaction: Transaction
  ): Promise<void> {
    // Validate dates
    if (request.checkIn >= request.checkOut) {
      throw new Error('Check-out must be after check-in');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (request.checkIn < today) {
      throw new Error('Check-in cannot be in the past');
    }

    // Validate nights calculation
    const calculatedNights = Math.ceil(
      (request.checkOut.getTime() - request.checkIn.getTime()) / (1000 * 60 * 60 * 24)
    );
    if (calculatedNights !== request.nights) {
      throw new Error(
        `Nights mismatch: expected ${calculatedNights}, got ${request.nights}`
      );
    }

    // Validate guests
    if (request.guests < 1) {
      throw new Error('At least 1 guest is required');
    }

    // Validate credits
    if (request.creditsToUse <= 0) {
      throw new Error('Credits must be greater than 0');
    }

    // Validate guest exists
    const guest = await User.findByPk(request.guestId, { transaction });
    if (!guest) {
      throw new Error(`User ${request.guestId} not found`);
    }
  }

  /**
   * Get or create credit account
   */
  private async getCreditAccount(
    userId: number,
    transaction: Transaction
  ): Promise<CreditAccount> {
    let account = await CreditAccount.findOne({
      where: { user_id: userId },
      transaction,
    });

    if (!account) {
      // Auto-create account
      account = await CreditAccount.create(
        {
          user_id: userId,
          balance: 0,
          currency: 'EUR',
          expiration_policy: '2_YEARS',
        },
        { transaction }
      );
    }

    return account;
  }

  /**
   * Deduct credits from account
   */
  private async deductCredits(
    accountId: number,
    amount: number,
    balanceBefore: number,
    bookingId: number,
    transaction: Transaction
  ): Promise<CreditTransaction> {
    return await CreditTransaction.create(
      {
        account_id: accountId,
        type: 'WEEK_BOOKING',
        amount: -amount, // Negative for debit
        balance_before: balanceBefore,
        balance_after: balanceBefore - amount,
        reference_type: 'v2_booking',
        reference_id: bookingId,
        description: `Booking payment (${amount} credits)`,
        metadata: JSON.stringify({ booking_id: bookingId }),
      },
      { transaction }
    );
  }

  /**
   * Refund credits to account
   */
  private async refundCredits(
    accountId: number,
    amount: number,
    balanceBefore: number,
    bookingId: number,
    transaction: Transaction
  ): Promise<CreditTransaction> {
    return await CreditTransaction.create(
      {
        account_id: accountId,
        type: 'REFUND',
        amount: amount, // Positive for credit
        balance_before: balanceBefore,
        balance_after: balanceBefore + amount,
        reference_type: 'v2_booking',
        reference_id: bookingId,
        description: `Booking cancellation refund (${amount} credits)`,
        metadata: JSON.stringify({ booking_id: bookingId }),
      },
      { transaction }
    );
  }

  /**
   * Generate unique confirmation code
   * 
   * Format: ABC-1234-2026
   */
  private generateConfirmationCode(propertyId: number): string {
    const prefix = String.fromCharCode(65 + (propertyId % 26)); // A-Z
    const timestamp = Date.now().toString().slice(-4);
    const year = new Date().getFullYear();
    return `${prefix}${prefix}${prefix}-${timestamp}-${year}`;
  }
}
