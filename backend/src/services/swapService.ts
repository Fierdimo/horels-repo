import { Week, SwapRequest, User, Property, Booking } from '../models';
import { Op, Sequelize } from 'sequelize';
import sequelize from '../config/database';

/**
 * Service for managing swap requests and matching compatible weeks
 */
export class SwapService {
  
  /**
   * Peak dates when swaps are not allowed
   */
  private static readonly PEAK_DATES = [
    { start: '12-15', end: '01-05', name: 'Christmas' },
    { start: '04-09', end: '04-16', name: 'Easter' },
    { start: '07-15', end: '08-25', name: 'Summer' }
  ];

  /**
   * Helper to get user email
   */
  private static async getUserEmail(userId: number): Promise<string> {
    const user = await User.findByPk(userId);
    return user?.email || '';
  }

  /**
   * Check if a date falls within peak season
   */
  static isPeakDate(date: Date): boolean {
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateStr = `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;

    for (const peak of this.PEAK_DATES) {
      const [peakMonth, peakDay] = peak.start.split('-').map(Number);
      const [endMonth, endDay] = peak.end.split('-').map(Number);

      // Handle year-crossing periods (Christmas)
      if (peakMonth > endMonth) {
        if (month >= peakMonth || month <= endMonth) {
          return true;
        }
      } else {
        if (month > peakMonth || (month === peakMonth && day >= peakDay)) {
          if (month < endMonth || (month === endMonth && day <= endDay)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if a week overlaps with peak dates
   */
  static weekOverlapsPeak(startDate: Date, endDate: Date): boolean {
    const current = new Date(startDate);
    while (current <= endDate) {
      if (this.isPeakDate(current)) {
        return true;
      }
      current.setDate(current.getDate() + 1);
    }
    return false;
  }

  /**
   * Find available weeks compatible with a swap request
   * Filters by:
   * - Same accommodation type
   * - Different owner
   * - Available status
   * - Not in peak dates
   * - Not overlapping with existing bookings/swaps
   */
  static async findCompatibleWeeks(
    requesterWeekId: number,
    requesterId: number,
    options?: {
      propertyId?: number;
      limit?: number;
    }
  ): Promise<any[]> {
    try {
      // Get requester's week details
      const requesterWeek = await Week.findByPk(requesterWeekId, {
        include: [{ model: Property, as: 'Property' }]
      });

      if (!requesterWeek) {
        throw new Error('Requester week not found');
      }

      // Validate requester week is available for swap
      if (requesterWeek.status !== 'available') {
        throw new Error('Requester week is not available for swap');
      }

      // Check if requester week overlaps peak dates
      if (this.weekOverlapsPeak(requesterWeek.start_date, requesterWeek.end_date)) {
        throw new Error('Requester week falls in peak season - swaps not allowed');
      }

      // Find compatible weeks
      const whereClause: any = {
        accommodation_type: requesterWeek.accommodation_type,
        owner_id: { [Op.ne]: requesterId }, // Different owner
        status: 'available',
        id: { [Op.ne]: requesterWeekId }, // Not the same week
      };

      if (options?.propertyId) {
        whereClause.property_id = options.propertyId;
      }

      const compatibleWeeks = await Week.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'Owner',
            attributes: ['id', 'firstName', 'lastName', 'email']
          },
          {
            model: Property,
            as: 'Property',
            attributes: ['id', 'name', 'location']
          }
        ],
        limit: options?.limit || 50,
        order: [['start_date', 'ASC']]
      });

      // Filter out weeks that overlap peak dates
      const validWeeks = compatibleWeeks.filter(week => 
        !this.weekOverlapsPeak(week.start_date, week.end_date)
      );

      // Check for conflicts with existing bookings/swaps for each week
      const weeksWithAvailability = await Promise.all(
        validWeeks.map(async (week) => {
          const availability = await this.checkWeekAvailability(week.id);
          return {
            ...week.toJSON(),
            availability
          };
        })
      );

      // Filter only available weeks
      return weeksWithAvailability.filter(w => w.availability.available);

    } catch (error) {
      console.error('Error finding compatible weeks:', error);
      throw error;
    }
  }

  /**
   * Check if a week has any conflicts (bookings or active swaps)
   */
  static async checkWeekAvailability(weekId: number): Promise<{
    available: boolean;
    conflicts: {
      bookings: number;
      activeSwaps: number;
    };
  }> {
    try {
      // Check for bookings overlapping this week
      const week = await Week.findByPk(weekId);
      if (!week) {
        return { available: false, conflicts: { bookings: 0, activeSwaps: 0 } };
      }

      const conflictingBookings = await Booking.count({
        where: {
          property_id: week.property_id,
          check_in: { [Op.lt]: week.end_date },
          check_out: { [Op.gt]: week.start_date },
          status: { [Op.ne]: 'cancelled' }
        }
      });

      // Check for active swap requests involving this week
      const conflictingSwaps = await SwapRequest.count({
        where: {
          [Op.or]: [
            { requester_week_id: weekId },
            { responder_week_id: weekId }
          ],
          status: { [Op.in]: ['pending', 'matched', 'awaiting_payment'] }
        }
      });

      const available = conflictingBookings === 0 && conflictingSwaps === 0;

      return {
        available,
        conflicts: {
          bookings: conflictingBookings,
          activeSwaps: conflictingSwaps
        }
      };

    } catch (error) {
      console.error('Error checking week availability:', error);
      throw error;
    }
  }

  /**
   * Create a new swap request
   */
  static async createSwapRequest(
    requesterId: number,
    requesterWeekId: number | string,
    responderWeekId: number | string | null,
    options?: {
      desired_start_date?: Date;
      desired_property_id?: number;
      notes?: string;
    }
  ): Promise<any> {
    const tx = await sequelize.transaction();

    try {
      // Detect if it's a booking ID (string like "booking_4") or week ID (number)
      let requesterWeek: any;
      const isBookingId = typeof requesterWeekId === 'string' && requesterWeekId.startsWith('booking_');
      
      if (isBookingId) {
        // Extract booking ID from string "booking_4"
        const bookingId = parseInt(requesterWeekId.split('_')[1], 10);
        const { Booking } = require('../models');
        
        const booking = await Booking.findByPk(bookingId, {
          include: [{ association: 'Property', attributes: ['id', 'name'] }]
        });

        if (!booking) {
          throw new Error('Booking not found');
        }

        if (booking.guest_email !== (await this.getUserEmail(requesterId))) {
          throw new Error('You can only swap your own bookings');
        }

        if (booking.status !== 'confirmed' && booking.status !== 'checked_in') {
          throw new Error('Booking is not available for swap');
        }

        // Transform booking to week-like structure for compatibility
        requesterWeek = {
          id: requesterWeekId,
          owner_id: requesterId,
          property_id: booking.property_id,
          start_date: booking.check_in,
          end_date: booking.check_out,
          accommodation_type: booking.room_type || 'Standard',
          status: 'available',
          source: 'booking',
          booking_id: bookingId,
          Property: booking.Property
        };
      } else {
        // Regular week lookup
        requesterWeek = await Week.findByPk(requesterWeekId, {
          include: [{ model: Property, as: 'Property' }]
        });

        if (!requesterWeek) {
          throw new Error('Requester week not found');
        }

        if (requesterWeek.owner_id !== requesterId) {
          throw new Error('You can only swap your own weeks');
        }

        if (requesterWeek.status !== 'available') {
          throw new Error('Week is not available for swap');
        }
      }

      // Peak dates validation is handled by staff approval, not at creation time
      // This allows swaps to be created even for peak season weeks for staff to review

      // Validate responder week if provided
      if (responderWeekId) {
        const responderWeek = await Week.findByPk(responderWeekId, {
          include: [{ model: Property, as: 'Property' }]
        });

        if (!responderWeek) {
          throw new Error('Responder week not found');
        }

        if (responderWeek.accommodation_type !== requesterWeek.accommodation_type) {
          throw new Error('Weeks must be of the same accommodation type');
        }

        if (responderWeek.owner_id === requesterId) {
          throw new Error('Cannot swap with your own weeks');
        }

        if (responderWeek.status !== 'available') {
          throw new Error('Responder week is not available');
        }

        if (this.weekOverlapsPeak(responderWeek.start_date, responderWeek.end_date)) {
          throw new Error('Responder week falls in peak season');
        }

        // Check responder week availability
        const responderAvailability = await this.checkWeekAvailability(Number(responderWeekId));
        if (!responderAvailability.available) {
          throw new Error('Responder week has conflicts');
        }
      }

      // Get property from requester week
      const property = await Property.findByPk((requesterWeek as any).property_id);
      if (!property) {
        throw new Error('Property not found');
      }

      // Create swap request (fee will be calculated when approved)
      const swapRequest = await SwapRequest.create(
        {
          requester_id: requesterId,
          requester_week_id: isBookingId ? null : Number(requesterWeekId),
          requester_source_type: isBookingId ? 'booking' : 'week',
          requester_source_id: isBookingId ? parseInt(requesterWeekId.split('_')[1], 10) : Number(requesterWeekId),
          responder_week_id: responderWeekId ? (typeof responderWeekId === 'string' && responderWeekId.startsWith('booking_') ? null : Number(responderWeekId)) : null,
          responder_source_type: responderWeekId && typeof responderWeekId === 'string' && responderWeekId.startsWith('booking_') ? 'booking' : (responderWeekId ? 'week' : null),
          responder_source_id: responderWeekId ? (typeof responderWeekId === 'string' && responderWeekId.startsWith('booking_') ? parseInt(responderWeekId.split('_')[1], 10) : Number(responderWeekId)) : null,
          desired_start_date: options?.desired_start_date,
          desired_property_id: options?.desired_property_id || null,
          notes: options?.notes || null,
          accommodation_type: requesterWeek.accommodation_type,
          status: responderWeekId ? 'matched' : 'pending',
          staff_approval_status: 'pending_review',
          responder_acceptance: 'pending',
          payment_status: 'pending',
          property_id: (requesterWeek as any).property_id
        },
        { transaction: tx }
      );

      await tx.commit();

      return swapRequest;

    } catch (error) {
      await tx.rollback();
      console.error('Error creating swap request:', error);
      throw error;
    }
  }

  /**
   * Get swap requests for an owner (as requester or responder)
   */
  static async getOwnerSwaps(
    ownerId: number,
    role: 'requester' | 'responder' | 'both' = 'both'
  ): Promise<any[]> {
    try {
      const whereClause: any = {};

      if (role === 'requester') {
        whereClause.requester_id = ownerId;
      } else if (role === 'responder') {
        // For responder, need to join with weeks to find if owner has the responder week
        whereClause.responder_week_id = {
          [Op.in]: Sequelize.literal(
            `(SELECT id FROM weeks WHERE owner_id = ${ownerId})`
          )
        };
      } else {
        // Both requester or has responder week
        whereClause[Op.or] = [
          { requester_id: ownerId },
          {
            responder_week_id: {
              [Op.in]: Sequelize.literal(
                `(SELECT id FROM weeks WHERE owner_id = ${ownerId})`
              )
            }
          }
        ];
      }

      const swaps = await SwapRequest.findAll({
        where: whereClause,
        include: [
          {
            model: Week,
            as: 'RequesterWeek',
            attributes: ['id', 'owner_id', 'property_id', 'accommodation_type', 'start_date', 'end_date', 'status'],
            include: [
              {
                model: User,
                as: 'Owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
              },
              {
                model: Property,
                as: 'Property',
                attributes: ['id', 'name', 'location', 'city', 'country']
              }
            ]
          },
          {
            model: Week,
            as: 'ResponderWeek',
            attributes: ['id', 'owner_id', 'property_id', 'accommodation_type', 'start_date', 'end_date', 'status'],
            include: [
              {
                model: User,
                as: 'Owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
              },
              {
                model: Property,
                as: 'Property',
                attributes: ['id', 'name', 'location', 'city', 'country']
              }
            ]
          },
          {
            model: User,
            as: 'Requester',
            attributes: ['id', 'firstName', 'lastName', 'email']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // Enrich swaps with booking data if source type is 'booking'
      const enrichedSwaps = await Promise.all(
        swaps.map(async (swap: any) => {
          const swapData = swap.toJSON();

          // Load requester booking data if needed
          if (swapData.requester_source_type === 'booking' && swapData.requester_source_id) {
            const booking = await Booking.findByPk(swapData.requester_source_id, {
              include: [
                {
                  association: 'Property',
                  attributes: ['id', 'name', 'location', 'city', 'country']
                }
              ]
            });

            if (booking) {
              swapData.RequesterWeek = {
                id: `booking_${booking.id}`,
                property_id: booking.property_id,
                accommodation_type: booking.room_type || 'Standard',
                start_date: booking.check_in,
                end_date: booking.check_out,
                status: booking.status,
                source: 'booking',
                booking_id: booking.id,
                Property: booking.Property
              };
            }
          }

          // Load responder booking data if needed
          if (swapData.responder_source_type === 'booking' && swapData.responder_source_id) {
            const booking = await Booking.findByPk(swapData.responder_source_id, {
              include: [
                {
                  association: 'Property',
                  attributes: ['id', 'name', 'location', 'city', 'country']
                }
              ]
            });

            if (booking) {
              swapData.ResponderWeek = {
                id: `booking_${booking.id}`,
                property_id: booking.property_id,
                accommodation_type: booking.room_type || 'Standard',
                start_date: booking.check_in,
                end_date: booking.check_out,
                status: booking.status,
                source: 'booking',
                booking_id: booking.id,
                Property: booking.Property
              };
            }
          }

          return swapData;
        })
      );

      return enrichedSwaps;

    } catch (error) {
      console.error('Error fetching owner swaps:', error);
      throw error;
    }
  }

  /**
   * Approve swap request (by staff)
   */
  static async approveSwap(
    swapId: number,
    staffId: number,
    notes?: string
  ): Promise<any> {
    try {
      const swap = await SwapRequest.findByPk(swapId);
      if (!swap) {
        throw new Error('Swap request not found');
      }

      if (swap.status !== 'pending' && swap.status !== 'matched') {
        throw new Error('Swap cannot be approved in its current status');
      }

      // Validate responder week availability again
      if (swap.responder_week_id) {
        const availability = await this.checkWeekAvailability(swap.responder_week_id);
        if (!availability.available) {
          throw new Error('Responder week is no longer available');
        }
      }

      const updated = await swap.update({
        staff_approval_status: 'approved',
        reviewed_by_staff_id: staffId,
        staff_review_date: new Date(),
        staff_notes: notes || null,
        status: 'awaiting_payment'
      });

      return updated;

    } catch (error) {
      console.error('Error approving swap:', error);
      throw error;
    }
  }

  /**
   * Reject swap request (by staff)
   */
  static async rejectSwap(
    swapId: number,
    staffId: number,
    reason: string
  ): Promise<any> {
    try {
      const swap = await SwapRequest.findByPk(swapId);
      if (!swap) {
        throw new Error('Swap request not found');
      }

      if (swap.status === 'completed' || swap.status === 'cancelled') {
        throw new Error('Cannot reject a completed or cancelled swap');
      }

      const updated = await swap.update({
        staff_approval_status: 'rejected',
        reviewed_by_staff_id: staffId,
        staff_review_date: new Date(),
        staff_notes: reason,
        status: 'cancelled'
      });

      return updated;

    } catch (error) {
      console.error('Error rejecting swap:', error);
      throw error;
    }
  }

  /**
   * Accept swap request (by responder owner)
   */
  static async acceptSwap(
    swapId: number,
    ownerId: number
  ): Promise<any> {
    try {
      const swap = await SwapRequest.findByPk(swapId, {
        include: [
          { model: Week, as: 'RequesterWeek' },
          { model: Week, as: 'ResponderWeek' }
        ]
      });

      if (!swap) {
        throw new Error('Swap request not found');
      }

      // Verify this owner owns the responder week
      const responderWeek = (swap as any).ResponderWeek;
      if (!responderWeek || responderWeek.owner_id !== ownerId) {
        throw new Error('You do not own the responder week');
      }

      if (swap.status !== 'awaiting_payment' && swap.status !== 'matched') {
        throw new Error('Swap cannot be accepted in its current status');
      }

      const updated = await swap.update({
        responder_acceptance: 'accepted',
        responder_acceptance_date: new Date(),
        status: 'awaiting_payment'
      });

      return updated;

    } catch (error) {
      console.error('Error accepting swap:', error);
      throw error;
    }
  }

  /**
   * Reject swap request (by responder owner)
   */
  static async rejectSwapRequest(
    swapId: number,
    ownerId: number
  ): Promise<any> {
    try {
      const swap = await SwapRequest.findByPk(swapId, {
        include: [{ model: Week, as: 'ResponderWeek' }]
      });

      if (!swap) {
        throw new Error('Swap request not found');
      }

      // Verify this owner owns the responder week
      const responderWeek = (swap as any).ResponderWeek;
      if (!responderWeek || responderWeek.owner_id !== ownerId) {
        throw new Error('You do not own the responder week');
      }

      if (swap.status === 'completed' || swap.status === 'cancelled') {
        throw new Error('Cannot reject a completed or cancelled swap');
      }

      const updated = await swap.update({
        responder_acceptance: 'rejected',
        responder_acceptance_date: new Date(),
        status: 'cancelled'
      });

      return updated;

    } catch (error) {
      console.error('Error rejecting swap:', error);
      throw error;
    }
  }

  /**
   * Complete swap after payment
   */
  static async completeSwap(
    swapId: number,
    paymentIntentId: string
  ): Promise<any> {
    const tx = await sequelize.transaction();

    try {
      const swap = await SwapRequest.findByPk(swapId, {
        include: [
          { model: Week, as: 'RequesterWeek' },
          { model: Week, as: 'ResponderWeek' }
        ],
        transaction: tx
      });

      if (!swap) {
        throw new Error('Swap request not found');
      }

      if (swap.status !== 'awaiting_payment') {
        throw new Error('Swap cannot be completed in its current status');
      }

      const requesterWeek = (swap as any).RequesterWeek;
      const responderWeek = (swap as any).ResponderWeek;

      if (!responderWeek) {
        throw new Error('No responder week assigned to this swap');
      }

      // Transfer ownership of weeks
      await requesterWeek.update(
        { owner_id: responderWeek.owner_id, status: 'confirmed' },
        { transaction: tx }
      );

      await responderWeek.update(
        { owner_id: requesterWeek.owner_id, status: 'confirmed' },
        { transaction: tx }
      );

      // Update swap status
      const updated = await swap.update(
        {
          status: 'completed',
          payment_intent_id: paymentIntentId,
          payment_status: 'paid',
          paid_at: new Date()
        },
        { transaction: tx }
      );

      await tx.commit();

      return updated;

    } catch (error) {
      await tx.rollback();
      console.error('Error completing swap:', error);
      throw error;
    }
  }

  /**
   * Get available swaps for a user to browse and accept
   * Returns: pending swaps from other owners where the accommodation type matches user's weeks
   */
  static async getAvailableSwapsForUser(userId: number): Promise<any[]> {
    try {
      // Get user info
      const user = await User.findByPk(userId, {
        attributes: ['id', 'email']
      });

      if (!user) {
        return [];
      }

      console.log(`[SwapService] Getting available swaps for user ${userId} (${user.email})`);

      // Get user's bookings (from marketplace) using email
      const userBookings = await Booking.findAll({
        where: { guest_email: user.email },
        attributes: ['id', 'room_type', 'check_in', 'check_out', 'status']
      });

      console.log(`[SwapService] User has ${userBookings.length} bookings:`, 
        userBookings.map(b => ({ 
          type: b.room_type, 
          checkIn: b.check_in, 
          checkOut: b.check_out,
          duration: Math.ceil((new Date(b.check_out).getTime() - new Date(b.check_in).getTime()) / (1000 * 60 * 60 * 24)),
          status: b.status
        }))
      );

      if (userBookings.length === 0) {
        console.log(`[SwapService] No bookings found for user, returning empty`);
        return [];
      }

      // Extract accommodation types and durations from user's bookings
      const userAccommodationTypes = [...new Set(userBookings.map(b => b.room_type))];
      const userDurations = userBookings.map(b => {
        const checkIn = new Date(b.check_in);
        const checkOut = new Date(b.check_out);
        return Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));
      });

      console.log(`[SwapService] User accommodation types:`, userAccommodationTypes);
      console.log(`[SwapService] User booking durations:`, userDurations);

      // Find pending swaps
      const swaps = await SwapRequest.findAll({
        where: {
          requester_id: { [Op.ne]: userId },
          status: 'pending',
          responder_week_id: null
        },
        include: [
          {
            model: Week,
            as: 'RequesterWeek',
            attributes: ['id', 'owner_id', 'property_id', 'accommodation_type', 'start_date', 'end_date', 'status'],
            include: [
              {
                model: User,
                as: 'Owner',
                attributes: ['id', 'firstName', 'lastName', 'email']
              },
              {
                model: Property,
                as: 'Property',
                attributes: ['id', 'name', 'location', 'city', 'country']
              }
            ]
          },
          {
            model: User,
            as: 'Requester',
            attributes: ['id', 'email']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      // For each swap, get the requester's matching bookings
      const swapsWithBookings = await Promise.all(swaps.map(async (swap: any) => {
        const requesterEmail = swap.Requester?.email;
        
        // If the swap is based on a booking, get only that specific booking
        const whereCondition: any = {
          guest_email: requesterEmail,
          status: 'confirmed'
        };
        
        if (swap.requester_source_type === 'booking' && swap.requester_source_id) {
          whereCondition.id = swap.requester_source_id;
        }
        
        const requesterBookings = await Booking.findAll({
          where: whereCondition,
          attributes: ['id', 'room_type', 'check_in', 'check_out', 'property_id'],
          include: [
            {
              model: Property,
              as: 'Property',
              attributes: ['id', 'name', 'location', 'city', 'country']
            }
          ]
        });
        
        console.log(`[SwapService] Requester bookings for ${requesterEmail}:`, requesterBookings.map(b => ({
          type: b.room_type,
          property: b.Property?.name,
          location: `${b.Property?.city || 'undefined'}, ${b.Property?.country || 'undefined'}`
        })));
        
        // Convert bookings to plain objects to ensure proper serialization
        const bookingsJSON = requesterBookings.map((b: any) => b.toJSON ? b.toJSON() : b);
        
        return {
          ...swap.toJSON(),
          RequesterBookings: bookingsJSON
        };
      }));

      console.log(`[SwapService] Found ${swapsWithBookings.length} pending swaps`);

      // Filter swaps based on matching accommodation type and duration
      const availableSwaps = [];

      for (const swap of swapsWithBookings) {
        try {
          console.log(`[SwapService] Swap ${swap.id} from ${swap.Requester.email}: ${swap.RequesterBookings.length} bookings`);

          // Check if any requester booking matches user's criteria
          for (const requesterBooking of swap.RequesterBookings) {
            const checkIn = new Date(requesterBooking.check_in);
            const checkOut = new Date(requesterBooking.check_out);
            const requesterDuration = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

            console.log(`[SwapService] Swap ${swap.id}: Checking booking type=${requesterBooking.room_type}, duration=${requesterDuration}`);
            console.log(`[SwapService] Swap ${swap.id}: User types=${userAccommodationTypes}, User durations=${userDurations}`);

            // Check if room type matches
            if (!userAccommodationTypes.includes(requesterBooking.room_type)) {
              console.log(`[SwapService] Swap ${swap.id}: Type mismatch - ${requesterBooking.room_type} not in ${userAccommodationTypes}`);
              continue;
            }

            // Check if duration matches any of user's bookings
            if (userDurations.includes(requesterDuration)) {
              console.log(`[SwapService] Swap ${swap.id}: MATCH! Adding to available swaps`);
              availableSwaps.push(swap);
              break;
            } else {
              console.log(`[SwapService] Swap ${swap.id}: Duration mismatch - ${requesterDuration} not in ${userDurations}`);
            }
          }
        } catch (error) {
          console.error(`[SwapService] Error processing swap ${swap.id}:`, error);
          continue;
        }
      }

      console.log(`[SwapService] Returning ${availableSwaps.length} available swaps`);
      console.log(`[SwapService] First swap example:`, JSON.stringify(availableSwaps[0], null, 2));
      return availableSwaps;

    } catch (error) {
      console.error('Error fetching available swaps for user:', error);
      throw error;
    }
  }
}

export default SwapService;
