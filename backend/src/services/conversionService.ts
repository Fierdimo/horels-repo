import LoggingService from './loggingService';
import { StripeService } from './stripeService';
import User from '../models/User';
import { SwapRequest as SwapRequestModel } from '../models';
import Fee from '../models/Fee';
import sequelize from '../config/database';

interface ConversionResult {
  success: boolean;
  userId: number;
  newRole: string;
  paymentId: string;
}

interface SwapData {
  id?: string;
  guestId: number;
  propertyId: string;
  checkIn: string;
  checkOut: string;
  status?: 'pending' | 'matched' | 'completed' | 'cancelled';
  createdAt?: Date;
  updatedAt?: Date;
}

interface SwapResult {
  success: boolean;
  swapId: string;
  status: string;
  paymentId?: string;
}

interface FeeRecord {
  id?: string;
  paymentId: string;
  amount: number;
  userId: number;
  type: 'swap_fee' | 'conversion_fee';
  status: 'pending' | 'completed' | 'failed';
  createdAt?: Date;
}

// Mock models - in a real implementation, these would be proper Sequelize models
class MockSwapModel {
  static async create(data: any): Promise<SwapData> {
    return {
      id: `swap_${Date.now()}`,
      ...data,
      status: data.status || 'pending',
      createdAt: new Date(),
    };
  }

  static async findAll(options: any): Promise<SwapData[]> {
    // Mock implementation - in reality would query database
    return [];
  }

  static async findByPk(id: string): Promise<SwapData | null> {
    // Mock implementation
    return {
      id,
      guestId: 1,
      propertyId: 'prop_123',
      checkIn: '2024-07-01',
      checkOut: '2024-07-05',
      status: 'pending',
    };
  }
}

class MockFeeModel {
  static async create(data: any): Promise<FeeRecord> {
    return {
      id: `fee_${Date.now()}`,
      ...data,
      status: data.status || 'completed',
      createdAt: new Date(),
    };
  }
}

class ConversionService {
  private stripeService: StripeService;
  private SwapModel: any;
  private FeeModel: any;
  private PlatformSettingModel: any;

  constructor(stripeService?: StripeService, swapModel?: any, feeModel?: any) {
    this.stripeService = stripeService || new StripeService();
    // Use real SwapRequest Sequelize model by default so swap lifecycle updates persist to DB
    this.SwapModel = swapModel || SwapRequestModel || MockSwapModel;
    this.FeeModel = feeModel || Fee || MockFeeModel;
    // PlatformSetting model for runtime-configurable settings
    // Import dynamically to avoid circular imports at module init
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const PlatformSetting = require('../models/PlatformSetting').default;
      this.PlatformSettingModel = PlatformSetting;
    } catch (e) {
      this.PlatformSettingModel = null;
    }
  }

  /**
   * Convert a guest user to owner with payment
   * NOTE: This is a manual/paid conversion. Automatic conversion happens via roleConversion utility.
   */
  async convertGuestToOwner(userId: number): Promise<ConversionResult> {
    try {
      // Find the user with role
      const user = await User.findByPk(userId, {
        include: [{ association: 'Role', attributes: ['name'] }]
      });
      
      if (!user) {
        throw new Error('User not found');
      }

      // Check if user is already an owner
      const userRole = (user as any).Role?.name;
      if (userRole !== 'guest') {
        throw new Error('User is not a guest');
      }

      // Determine conversion fee at runtime
      const conversionFee = await this.calculateSwapFee();
      // Create payment intent for conversion fee (euros)
      const paymentResult = await this.stripeService.createPaymentIntent(
        conversionFee,
        'eur',
        'swap_fee',
        { userId: userId.toString(), type: 'conversion' }
      );

      // Confirm the payment
      const confirmedPayment = await this.stripeService.confirmPayment(paymentResult.id);

      if (confirmedPayment.status !== 'succeeded') {
        throw new Error('Payment failed');
      }

      // Get owner role ID
      const Role = require('../models/Role').default;
      const ownerRole = await Role.findOne({ where: { name: 'owner' } });
      if (!ownerRole) {
        throw new Error('Owner role not found');
      }

      // Update user role to owner
      await user.update({ role_id: ownerRole.id });

      // Record the fee payment
      await this.recordFeePayment(
        confirmedPayment.id,
        conversionFee,
        userId,
        'conversion_fee'
      );

      // Log the conversion
      await LoggingService.logAction({
        action: 'guest_to_owner_conversion',
        details: {
          userId,
          oldRole: 'guest',
          newRole: 'owner',
          paymentId: confirmedPayment.id,
        },
      });

      return {
        success: true,
        userId,
        newRole: 'owner',
        paymentId: confirmedPayment.id,
      };

    } catch (error: any) {
      console.error('Guest to owner conversion error:', error.message);

      // Log the error
      await LoggingService.logAction({
        action: 'conversion_error',
        details: {
          userId,
          error: error.message,
        },
      });

      throw new Error(`Conversion failed: ${error.message}`);
    }
  }

  /**
   * Create a swap request
   */
  public async createSwapRequest(
    guestId: number,
    propertyId: string,
    checkIn: string,
    checkOut: string
  ): Promise<SwapData> {
    try {
      // Validate dates
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (checkInDate >= checkOutDate) {
        throw new Error('Check-out date must be after check-in date');
      }

      const swap = await this.SwapModel.create({
        guestId,
        propertyId,
        checkIn,
        checkOut,
        status: 'pending',
      });

      // Log the swap creation
      await LoggingService.logAction({
        action: 'swap_request_created',
        details: {
          swapId: swap.id,
          guestId,
          propertyId,
          checkIn,
          checkOut,
        },
      });

      return swap;

    } catch (error: any) {
      console.error('Create swap request error:', error.message);
      throw new Error(`Failed to create swap request: ${error.message}`);
    }
  }

  /**
   * Find matching swaps for a property and dates
   */
  public async findMatchingSwaps(
    propertyId: string,
    checkIn: string,
    checkOut: string
  ): Promise<SwapData[]> {
    try {
      const swaps = await this.SwapModel.findAll({
        where: {
          propertyId,
          checkIn,
          checkOut,
          status: 'pending',
        },
      });

      return swaps;

    } catch (error: any) {
      console.error('Find matching swaps error:', error.message);
      throw new Error(`Failed to find matching swaps: ${error.message}`);
    }
  }

  /**
   * Complete a swap with payment
   */
  public async completeSwap(swapId: string, existingPaymentIntentId?: string, bookingIdParam?: number): Promise<SwapResult> {
    // Step 1: acquire a DB row-level lock and mark swap as processing
    let swap: any = null;
    try {
      const t = await sequelize.transaction();
      try {
        swap = await this.SwapModel.findByPk(swapId, { transaction: t, lock: t.LOCK.UPDATE });
        if (!swap) {
          await t.rollback();
          throw new Error('Swap not found');
        }

        // Only allow completion if swap was approved/matched by the responder/hotel
        if (swap.status !== 'matched') {
          await t.rollback();
          throw new Error('Swap is not approved for completion');
        }

        // Prevent concurrent completions by marking as processing
        if (swap.status === 'processing' || swap.status === 'completed') {
          await t.rollback();
          throw new Error('Swap is already being processed or completed');
        }

        await swap.update({ status: 'processing' }, { transaction: t });
        await t.commit();
      } catch (err) {
        await t.rollback();
        throw err;
      }
    } catch (err: any) {
      console.error('Complete swap error (lock phase):', err.message);
      throw new Error(`Failed to begin swap completion: ${err.message}`);
    }

    // Step 2: perform payment outside the short DB transaction
    let confirmedPayment: any;
    try {
      if (existingPaymentIntentId) {
        confirmedPayment = await this.stripeService.confirmPayment(existingPaymentIntentId);
        if (confirmedPayment.status !== 'succeeded') {
          // revert swap to matched so it can be retried or investigated
          await swap.update({ status: 'matched' });
          throw new Error('Provided payment intent is not succeeded');
        }
      } else {
        const swapFee = await this.calculateSwapFee();
        const paymentResult = await this.stripeService.createPaymentIntent(
          swapFee,
          'eur',
          'swap_fee',
          { swapId: swap.id || swapId, requesterId: swap.requester_id }
        );

        confirmedPayment = await this.stripeService.confirmPayment(paymentResult.id);
        if (confirmedPayment.status !== 'succeeded') {
          await swap.update({ status: 'matched' });
          throw new Error('Payment failed');
        }
      }

      // Step 3: mark swap completed and persist fee
      if (typeof swap.update === 'function') {
        await swap.update({ status: 'completed' });
      }

      // Persist fee and link to booking when provided. Try to extract chargeId if present.
      const swapFeeAmount = await this.calculateSwapFee();
      const chargeId = (confirmedPayment && (confirmedPayment as any).chargeId) ? (confirmedPayment as any).chargeId : null;
      await this.recordFeePayment(
        confirmedPayment.id,
        swapFeeAmount,
        swap.requester_id || swap.guestId,
        'swap_fee',
        bookingIdParam || null,
        chargeId
      );

      await LoggingService.logAction({
        action: 'swap_completed',
        details: {
          swapId: swap.id || swapId,
          requesterId: swap.requester_id || null,
          requesterWeekId: swap.requester_week_id || null,
          responderWeekId: swap.responder_week_id || null,
          paymentId: confirmedPayment.paymentIntentId,
        },
      });

      return {
        success: true,
        swapId,
        status: 'completed',
        paymentId: confirmedPayment.paymentIntentId,
      };
    } catch (error: any) {
      console.error('Complete swap error (payment phase):', error.message);
      throw new Error(`Failed to complete swap: ${error.message}`);
    }
  }

  /**
   * Calculate swap fee amount
   */
  public async calculateSwapFee(): Promise<number> {
    // Try DB-configured fee first (value in euros)
    try {
      // Always require the PlatformSetting model at call-time to avoid
      // stale/cached model references when app/modules are imported
      // before database sync in tests. Using a local reference ensures
      // we read the latest DB state written during the same test run.
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        // Require directly each time instead of relying on constructor cache
        // so updates made by controller handlers are visible immediately.
        // The required module exports the Sequelize model as default.
        // Note: wrap in try/catch since the model/table might not exist yet.
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const PlatformSettingLocal = require('../models/PlatformSetting').default;
        if (PlatformSettingLocal) {
          const row = await PlatformSettingLocal.findOne({ where: { key: 'swap_fee' } });
          if (row && row.value) {
            const parsed = Number(row.value);
            if (!Number.isNaN(parsed)) return parsed;
          }
        }
      } catch (innerErr) {
        // ignore and fallback to env/default
      }
    } catch (e) {
      // ignore and fallback
    }

    // Fallback to environment variable or default 10
    const envVal = process.env.SWAP_FEE || process.env.SWAP_FEE_EUR;
    if (envVal) {
      const parsedEnv = Number(envVal);
      if (!Number.isNaN(parsedEnv)) return parsedEnv;
    }

    return 10;
  }

  /**
   * Validate fee amount
   */
  public async isValidFeeAmount(amount: number): Promise<boolean> {
    const current = await this.calculateSwapFee();
    return amount === current;
  }

  /**
   * Record a fee payment
   */
  public async recordFeePayment(
    paymentId: string,
    amount: number,
    userId: number,
    type: 'swap_fee' | 'conversion_fee',
    bookingId?: number | null,
    stripeChargeId?: string | null
  ): Promise<FeeRecord> {
    try {
      const feeData: any = {
        paymentId,
        amount,
        userId,
        type,
        status: 'completed',
      };
      if (bookingId) feeData.bookingId = bookingId;
      if (stripeChargeId) feeData.stripeChargeId = stripeChargeId;

      const fee = await this.FeeModel.create(feeData);

      return fee;

    } catch (error: any) {
      console.error('Record fee payment error:', error.message);
      throw new Error(`Failed to record fee payment: ${error.message}`);
    }
  }
}

export default ConversionService;
 