import { NightCreditRequest, NightCredit, Booking, Week, SwapRequest, Property, User } from '../models';
import { Op, Transaction } from 'sequelize';
import sequelize from '../config/database';
import pricingService from './pricingService';
import bookingStatusService from './bookingStatusService';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export class NightCreditService {
  /**
   * Create a night credit request (owner wants to use credits)
   */
  async createRequest(data: {
    ownerId: number;
    creditId: number;
    propertyId: number;
    checkIn: Date;
    checkOut: Date;
    nightsRequested: number;
    additionalNights?: number;
    roomType?: string;
  }) {
    const {
      ownerId,
      creditId,
      propertyId,
      checkIn,
      checkOut,
      nightsRequested,
      additionalNights = 0,
      roomType
    } = data;

    // Validate credit exists and belongs to owner
    const credit = await NightCredit.findOne({
      where: {
        id: creditId,
        owner_id: ownerId,
        status: 'active',
        expiry_date: { [Op.gt]: new Date() }
      }
    });

    if (!credit) {
      throw new Error('Night credit not found or expired');
    }

    // Validate sufficient credits
    if (credit.remaining_nights < nightsRequested) {
      throw new Error(`Insufficient night credits. Available: ${credit.remaining_nights}, Requested: ${nightsRequested}`);
    }

    // Check for existing pending request with same credit
    const existingRequest = await NightCreditRequest.findOne({
      where: {
        credit_id: creditId,
        status: 'pending'
      }
    });

    if (existingRequest) {
      throw new Error('You already have a pending request with this credit');
    }

    // Calculate additional cost if buying extra nights
    let additionalPrice = 0;
    let additionalCommission = 0;
    let paymentStatus: 'not_required' | 'pending' = 'not_required';

    if (additionalNights > 0) {
      // Get property base price (you might want to get this from Room model)
      const property = await Property.findByPk(propertyId);
      if (!property) {
        throw new Error('Property not found');
      }

      // Estimate price (€100/night as default, should come from room pricing)
      const basePrice = 100; // TODO: Get from room/property
      const totalBasePrice = basePrice * additionalNights;
      
      const pricing = await pricingService.getPriceBreakdown(totalBasePrice);
      additionalPrice = pricing.guestPrice;
      additionalCommission = pricing.commission;
      paymentStatus = 'pending';
    }

    // Create request
    const request = await NightCreditRequest.create({
      owner_id: ownerId,
      credit_id: creditId,
      property_id: propertyId,
      check_in: checkIn,
      check_out: checkOut,
      nights_requested: nightsRequested,
      room_type: roomType,
      status: 'pending',
      additional_nights: additionalNights,
      additional_price: additionalPrice,
      additional_commission: additionalCommission,
      payment_status: paymentStatus,
    });

    return request;
  }

  /**
   * Get requests for an owner
   */
  async getOwnerRequests(ownerId: number) {
    const requests = await NightCreditRequest.findAll({
      where: { owner_id: ownerId },
      include: [
        {
          model: Property,
          as: 'Property',
          attributes: ['id', 'name', 'location']
        },
        {
          model: NightCredit,
          as: 'Credit',
          attributes: ['id', 'remaining_nights', 'expiry_date']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    return requests;
  }

  /**
   * Get pending requests for staff of a property
   */
  async getStaffRequests(propertyId: number) {
    const requests = await NightCreditRequest.findAll({
      where: {
        property_id: propertyId,
        status: 'pending'
      },
      include: [
        {
          model: User,
          as: 'Owner',
          attributes: ['id', 'email']
        },
        {
          model: NightCredit,
          as: 'Credit',
          attributes: ['id', 'remaining_nights', 'total_nights', 'expiry_date']
        },
        {
          model: Property,
          as: 'Property',
          attributes: ['id', 'name', 'location']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    return requests;
  }

  /**
   * Check availability for a night credit request
   */
  async checkAvailability(requestId: number) {
    const request = await NightCreditRequest.findByPk(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    // Check for conflicting bookings
    const conflictingBookings = await Booking.count({
      where: {
        property_id: request.property_id,
        check_in: { [Op.lte]: request.check_out },
        check_out: { [Op.gte]: request.check_in },
        status: { [Op.in]: ['confirmed', 'pending'] }
      }
    });

    // Check for conflicting weeks
    const conflictingWeeks = await Week.count({
      where: {
        property_id: request.property_id,
        start_date: { [Op.lte]: request.check_out },
        end_date: { [Op.gte]: request.check_in },
        status: { [Op.in]: ['available', 'confirmed'] }
      }
    });

    // Check for conflicting swap requests
    const conflictingSwaps = await SwapRequest.count({
      where: {
        property_id: request.property_id,
        status: { [Op.in]: ['pending', 'matched', 'awaiting_payment'] }
      }
    });

    return {
      available: conflictingBookings === 0 && conflictingWeeks === 0 && conflictingSwaps === 0,
      conflicts: {
        bookings: conflictingBookings,
        weeks: conflictingWeeks,
        swaps: conflictingSwaps
      }
    };
  }

  /**
   * Staff approves a night credit request
   */
  async approveRequest(requestId: number, staffId: number, notes?: string) {
    const request = await NightCreditRequest.findByPk(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error(`Request is not pending (current status: ${request.status})`);
    }

    // Re-check availability
    const availability = await this.checkAvailability(requestId);
    if (!availability.available) {
      throw new Error(`Cannot approve: conflicts detected (bookings: ${availability.conflicts.bookings}, weeks: ${availability.conflicts.weeks}, swaps: ${availability.conflicts.swaps})`);
    }

    // Update request
    await request.update({
      status: 'approved',
      reviewed_by_staff_id: staffId,
      review_date: new Date(),
      staff_notes: notes
    });

    // If no additional payment needed, complete immediately
    if (request.additional_nights === 0 || request.payment_status === 'not_required') {
      await this.completeRequest(requestId);
    }

    return request;
  }

  /**
   * Staff rejects a night credit request
   */
  async rejectRequest(requestId: number, staffId: number, reason: string) {
    const request = await NightCreditRequest.findByPk(requestId);
    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('Request is not pending');
    }

    await request.update({
      status: 'rejected',
      reviewed_by_staff_id: staffId,
      review_date: new Date(),
      staff_notes: reason
    });

    return request;
  }

  /**
   * Create payment intent for additional nights
   */
  async createPaymentIntent(requestId: number) {
    const request = await NightCreditRequest.findByPk(requestId, {
      include: [
        { model: User, as: 'Owner' },
        { model: Property, as: 'Property' }
      ]
    });

    if (!request) {
      throw new Error('Request not found');
    }

    if (request.status !== 'approved') {
      throw new Error('Request must be approved before payment');
    }

    if (request.additional_nights === 0) {
      throw new Error('No additional nights to pay for');
    }

    const owner = (request as any).Owner;
    const property = (request as any).Property;

    // Create Payment Intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(request.additional_price * 100),
      currency: 'eur',
      // customer: owner.stripe_customer_id, // TODO: Add when stripe customer setup
      description: `Additional ${request.additional_nights} nights at ${property.name}`,
      metadata: {
        type: 'night_credit_extension',
        request_id: requestId,
        owner_id: request.owner_id,
        property_id: request.property_id,
        credit_nights: request.nights_requested,
        paid_nights: request.additional_nights
      }
    });

    // Update request with payment intent
    await request.update({
      payment_intent_id: paymentIntent.id,
      payment_status: 'pending'
    });

    return {
      clientSecret: paymentIntent.client_secret,
      amount: request.additional_price
    };
  }

  /**
   * Complete request after payment (or if no payment needed)
   */
  async completeRequest(requestId: number) {
    return await sequelize.transaction(async (t: Transaction) => {
      const request = await NightCreditRequest.findByPk(requestId, {
        include: [{ model: NightCredit, as: 'Credit' }],
        transaction: t,
        lock: true
      });

      if (!request) {
        throw new Error('Request not found');
      }

      if (request.status !== 'approved') {
        throw new Error('Request must be approved');
      }

      const credit = (request as any).Credit;

      // Create booking
      const totalNights = request.nights_requested + request.additional_nights;
      const owner = await User.findByPk(request.owner_id, { transaction: t });
      
      const booking = await Booking.create({
        property_id: request.property_id,
        guest_name: owner?.email || 'Guest',
        guest_email: owner?.email || `guest-${Date.now()}@example.com`,
        check_in: request.check_in,
        check_out: request.check_out,
        room_type: request.room_type,
        status: 'confirmed',
        guest_token: `gt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        night_credit_id: String(request.credit_id),
        payment_reference: request.payment_intent_id || null,
        // Payment fields for additional nights
        hotel_price_per_night: request.additional_nights > 0 
          ? (request.additional_price - request.additional_commission) / request.additional_nights 
          : 0,
        guest_price_per_night: request.additional_nights > 0 
          ? request.additional_price / request.additional_nights 
          : 0,
        commission_per_night: request.additional_nights > 0 
          ? request.additional_commission / request.additional_nights 
          : 0,
        total_guest_amount: request.additional_price,
        total_hotel_payout: request.additional_price - request.additional_commission,
        total_platform_commission: request.additional_commission,
        payment_status: request.additional_nights > 0 ? 'paid' : 'not_applicable'
      }, { transaction: t });

      // Update credit balance
      const newRemaining = credit.remaining_nights - request.nights_requested;
      await credit.update({
        remaining_nights: newRemaining,
        status: newRemaining === 0 ? 'used' : 'active'
      }, { transaction: t });

      // Update request
      await request.update({
        status: 'completed',
        booking_id: booking.id
      }, { transaction: t });

      // Update room status if room_id is assigned
      if (booking.room_id) {
        // Don't await, let it run async to not slow down the transaction
        bookingStatusService.onBookingCreated(booking.id).catch(err => {
          console.error('Error updating room status after booking creation:', err);
        });
      }

      return { request, booking, credit };
    });
  }

  /**
   * Handle Stripe webhook for payment confirmation
   */
  async handlePaymentSuccess(paymentIntentId: string) {
    const request = await NightCreditRequest.findOne({
      where: { payment_intent_id: paymentIntentId }
    });

    if (!request) {
      throw new Error('Request not found for payment intent');
    }

    // Update payment status
    await request.update({
      payment_status: 'paid'
    });

    // Complete the request (create booking + deduct credits)
    await this.completeRequest(request.id);

    return request;
  }
}

export const nightCreditService = new NightCreditService();
