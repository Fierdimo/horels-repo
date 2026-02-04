import { Transaction } from 'sequelize';
import sequelize from '../config/database';
import InventoryService from './InventoryService';
import CreditCalculationService from './CreditCalculationService';
import CreditWalletService from './CreditWalletService';
import Booking from '../models/Booking';
import InventoryItem from '../models/InventoryItem';
import Property from '../models/Property';

interface PaymentOption {
  type: 'credits_only' | 'credits_plus_cash' | 'cash_only';
  creditsUsed: number;
  cashAmount: number; // in euros
  description: string;
  canAfford: boolean;
}

interface PaymentCalculation {
  availableCredits: number;
  requiredCredits: number;
  difference: number; // positive if surplus, negative if deficit
  options: PaymentOption[];
}

interface BookingRequest {
  inventoryItemId: number;
  ownerId: number;
  paymentType: 'credits_only' | 'credits_plus_cash';
  creditsToUse: number;
  cashAmount?: number; // in euros
  stripePaymentMethodId?: string; // for cash payments
}

interface BookingResult {
  booking: Booking;
  inventoryItem: InventoryItem;
  creditsUsed: number;
  cashPaid: number;
  walletBalanceAfter: number;
}

/**
 * CreditBookingService
 * Handles booking weeks from inventory using credits
 * Wrapper that coordinates InventoryService, CreditCalculationService, and CreditWalletService
 */
class CreditBookingService {

  /**
   * Calculate payment options for an inventory item
   */
  async calculatePaymentOptions(
    ownerId: number,
    inventoryItemId: number
  ): Promise<PaymentCalculation> {
    
    // Get inventory item
    const item = await InventoryService.getById(inventoryItemId);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    if (!item.isAvailable()) {
      throw new Error('Inventory item is not available');
    }

    const requiredCredits = item.credit_price;

    // Get owner's wallet balance (using existing service)
    const wallet = await CreditWalletService.getWallet(ownerId);
    const availableCredits = wallet.total_balance;

    const difference = availableCredits - requiredCredits;

    const options: PaymentOption[] = [];

    // Option 1: Credits Only (if user has enough)
    if (difference >= 0) {
      options.push({
        type: 'credits_only',
        creditsUsed: requiredCredits,
        cashAmount: 0,
        description: `Use ${requiredCredits} credits`,
        canAfford: true
      });
    }

    // Option 2: Credits + Cash (if user doesn't have enough credits)
    if (difference < 0) {
      const creditShortfall = Math.abs(difference);
      
      // Use existing hybrid payment calculation
      const hybrid = await CreditCalculationService.calculateHybridPayment(
        availableCredits,
        requiredCredits
      );

      options.push({
        type: 'credits_plus_cash',
        creditsUsed: hybrid.creditsUsed,
        cashAmount: hybrid.cashRequired,
        description: `Use ${hybrid.creditsUsed} credits + €${hybrid.cashRequired}`,
        canAfford: true // Assuming credit card payment available
      });
    }

    // Option 3: Cash Only (convert all credits to cash value)
    const cashEquivalent = await CreditCalculationService.convertCreditsToEuros(requiredCredits);
    options.push({
      type: 'cash_only',
      creditsUsed: 0,
      cashAmount: cashEquivalent,
      description: `Pay €${cashEquivalent} (no credits used)`,
      canAfford: true // Assuming credit card payment available
    });

    return {
      availableCredits,
      requiredCredits,
      difference,
      options
    };
  }

  /**
   * Create a booking using credits
   * 
   * Process:
   * 1. Reserve inventory item
   * 2. Validate payment
   * 3. Deduct credits from wallet
   * 4. Process cash payment if needed
   * 5. Create booking record
   * 6. Confirm inventory sale
   */
  async bookWithCredits(request: BookingRequest): Promise<BookingResult> {
    return await sequelize.transaction(async (tx: Transaction) => {
      
      // 1. Reserve inventory item (15 minute hold)
      const reservation = await InventoryService.reserve(
        request.inventoryItemId,
        request.ownerId,
        15, // 15 minutes
        tx
      );

      if (!reservation.success) {
        throw new Error(reservation.error || 'Failed to reserve item');
      }

      const item = reservation.item!;

      // 2. Validate payment matches item price
      const totalPayment = request.creditsToUse + (request.cashAmount || 0);
      const requiredCredits = item.credit_price;

      // Calculate cash equivalent if hybrid payment
      let cashEquivalentOfCredits = 0;
      if (request.cashAmount && request.cashAmount > 0) {
        const creditShortfall = requiredCredits - request.creditsToUse;
        cashEquivalentOfCredits = await CreditCalculationService.convertCreditsToEuros(creditShortfall);
        
        // Allow small rounding differences (±1 euro)
        if (Math.abs(request.cashAmount - cashEquivalentOfCredits) > 1) {
          throw new Error(`Cash amount mismatch. Expected ~€${cashEquivalentOfCredits}, got €${request.cashAmount}`);
        }
      }

      // Validate total payment
      if (request.paymentType === 'credits_only') {
        if (request.creditsToUse !== requiredCredits) {
          throw new Error(`Insufficient credits. Need ${requiredCredits}, using ${request.creditsToUse}`);
        }
      }

      // 3. Deduct credits from wallet (using existing service)
      let creditsUsed = 0;
      if (request.creditsToUse > 0) {
        await CreditWalletService.deduct(
          request.ownerId,
          request.creditsToUse,
          'BOOKING_PAYMENT',
          `Booking payment for inventory item #${request.inventoryItemId}`,
          tx,
          {
            inventoryItemId: request.inventoryItemId,
            weekId: item.week_id,
            propertyId: item.property_id
          }
        );
        creditsUsed = request.creditsToUse;
      }

      // 4. Process cash payment if needed
      let cashPaid = 0;
      let stripeChargeId: string | undefined;
      
      if (request.cashAmount && request.cashAmount > 0) {
        if (!request.stripePaymentMethodId) {
          throw new Error('Payment method required for cash payment');
        }

        // Get user details for Stripe
        const { User } = await import('../models');
        const owner = await User.findByPk(request.ownerId);
        if (!owner) {
          throw new Error('Owner not found');
        }

        // Integrate with StripeService for actual charge
        const { StripeService } = await import('./stripeService');
        const stripeService = new StripeService();

        // Get or create Stripe customer
        const customerId = await stripeService.getOrCreateCustomer(
          request.ownerId,
          owner.email,
          `${owner.first_name || ''} ${owner.last_name || ''}`.trim()
        );

        // Create and confirm payment intent
        const paymentIntent = await stripeService.createCreditMarketplacePaymentIntent({
          amount: request.cashAmount,
          currency: 'eur',
          customerId,
          paymentMethodId: request.stripePaymentMethodId,
          inventoryItemId: request.inventoryItemId,
          weekId: item.week_id,
          propertyId: item.property_id,
          creditsUsed: request.creditsToUse,
          description: `Hybrid payment for inventory #${request.inventoryItemId} (${request.creditsToUse} credits + €${request.cashAmount})`
        });

        cashPaid = request.cashAmount;
        stripeChargeId = paymentIntent.id;
      }

      // 5. Create booking record
      const booking = await Booking.create({
        property_id: item.property_id,
        room_id: null,
        guest_name: 'TBD', // Should be filled from user profile
        guest_email: 'TBD',
        check_in: item.start_date || new Date(),
        check_out: item.end_date || new Date(),
        room_type: item.accommodation_type,
        status: 'confirmed',
        guest_token: `booking_${Date.now()}`,
        payment_method: request.paymentType === 'credits_only' ? 'CREDITS' : 'HYBRID',
        total_amount: cashPaid,
        payment_status: 'paid',
        raw: {
          credits_used: creditsUsed,
          cash_amount: cashPaid,
          inventory_item_id: request.inventoryItemId,
          week_id: item.week_id,
          owner_id: request.ownerId
        }
      }, { transaction: tx });

      // 6. Confirm inventory sale
      await InventoryService.confirmBooking(
        request.inventoryItemId,
        booking.id,
        request.ownerId,
        tx
      );

      // Get updated wallet balance
      const updatedWallet = await CreditWalletService.getWallet(request.ownerId);

      return {
        booking,
        inventoryItem: item,
        creditsUsed,
        cashPaid,
        walletBalanceAfter: updatedWallet.total_balance
      };
    });
  }

  /**
   * Cancel a booking and refund credits
   * (Only if within cancellation policy)
   */
  async cancelBooking(
    bookingId: number,
    ownerId: number,
    reason: string
  ): Promise<{
    success: boolean;
    creditsRefunded: number;
    cashRefunded: number;
    message: string;
  }> {
    return await sequelize.transaction(async (tx: Transaction) => {
      
      const booking = await Booking.findByPk(bookingId, {
        lock: true,
        transaction: tx
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      // Check ownership through raw metadata
      const metadata = booking.raw as any;
      if (!metadata || metadata.owner_id !== ownerId) {
        throw new Error('Not authorized to cancel this booking');
      }

      if (booking.status === 'cancelled') {
        throw new Error('Booking already cancelled');
      }

      // Check cancellation policy
      // TODO: Implement proper cancellation policy check
      const now = new Date();
      const checkInDate = booking.check_in;
      if (checkInDate) {
        const daysUntilCheckIn = Math.ceil((checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysUntilCheckIn < 7) {
          throw new Error('Cancellation not allowed less than 7 days before check-in');
        }
      }

      // Refund credits
      let creditsRefunded = 0;
      if (metadata && metadata.credits_used && metadata.credits_used > 0) {
        await CreditWalletService.deposit(
          ownerId,
          metadata.credits_used,
          'BOOKING_REFUND',
          `Refund for cancelled booking #${bookingId}`,
          tx,
          {
            bookingId: booking.id,
            reason
          }
        );
        creditsRefunded = metadata.credits_used;
      }

      // Refund cash
      let cashRefunded = 0;
      if (metadata && metadata.cash_amount && metadata.cash_amount > 0) {
        // TODO: Integrate with StripeService for refund
        // await StripeService.refund(booking.stripe_charge_id, metadata.cash_amount);
        cashRefunded = metadata.cash_amount;
      }

      // Update booking status
      await booking.update({
        status: 'cancelled',
        cancelled_at: new Date(),
        cancellation_reason: reason
      }, { transaction: tx });

      // Return week to inventory (if not too close to check-in)
      const inventoryItem = await InventoryItem.findOne({
        where: { booking_id: bookingId },
        transaction: tx
      });

      if (inventoryItem) {
        await inventoryItem.update({
          status: 'available',
          booked_by: null,
          booking_id: null,
          booked_at: null
        }, { transaction: tx });
      }

      return {
        success: true,
        creditsRefunded,
        cashRefunded,
        message: `Booking cancelled. Refunded ${creditsRefunded} credits${cashRefunded > 0 ? ` and €${cashRefunded}` : ''}.`
      };
    });
  }

  /**
   * Get user's bookings made with credits
   */
  async getUserCreditBookings(ownerId: number): Promise<Booking[]> {
    // Since Booking doesn't have owner_id, we filter using raw metadata
    const allBookings = await Booking.findAll({
      include: [
        {
          model: Property,
          as: 'Property',
          attributes: ['id', 'name', 'location', 'city', 'country']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Filter by owner_id in metadata
    return allBookings.filter(booking => {
      const metadata = booking.raw as any;
      return metadata && metadata.owner_id === ownerId;
    });
  }

  /**
   * Preview booking details before confirming
   */
  async previewBooking(
    ownerId: number,
    inventoryItemId: number
  ): Promise<{
    item: InventoryItem;
    paymentOptions: PaymentCalculation;
    estimatedCheckIn?: Date;
    estimatedCheckOut?: Date;
    nights?: number;
  }> {
    const item = await InventoryService.getById(inventoryItemId);
    if (!item) {
      throw new Error('Inventory item not found');
    }

    const paymentOptions = await this.calculatePaymentOptions(ownerId, inventoryItemId);

    return {
      item,
      paymentOptions,
      estimatedCheckIn: item.start_date || undefined,
      estimatedCheckOut: item.end_date || undefined,
      nights: item.nights || undefined
    };
  }
}

export default new CreditBookingService();
