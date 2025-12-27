import { Request, Response } from 'express';
import CreditWalletService from '../services/CreditWalletService';
import CreditCalculationService from '../services/CreditCalculationService';

/**
 * Controller for credit wallet operations
 */
class CreditWalletController {

  /**
   * GET /api/credits/wallet/:userId
   * Get user wallet summary
   */
  async getWallet(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);

      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const summary = await CreditWalletService.getWalletSummary(userId);

      res.json({
        success: true,
        data: {
          wallet: {
            userId: summary.wallet.user_id,
            totalBalance: Number(summary.wallet.total_balance),
            totalEarned: Number(summary.wallet.total_earned),
            totalSpent: Number(summary.wallet.total_spent),
            totalExpired: Number(summary.wallet.total_expired),
            pendingExpiration: Number(summary.wallet.pending_expiration)
          },
          expirations: {
            in30Days: summary.expiringIn30Days,
            in60Days: summary.expiringIn60Days,
            in90Days: summary.expiringIn90Days,
            nextExpirationDate: summary.nextExpirationDate
          },
          activeTransactions: summary.activeTransactions.map(tx => ({
            id: tx.id,
            amount: Number(tx.amount),
            depositedAt: tx.deposited_at,
            expiresAt: tx.expires_at,
            daysUntilExpiration: CreditCalculationService.calculateDaysUntilExpiration(tx.expires_at!),
            status: tx.status
          }))
        }
      });

    } catch (error: any) {
      console.error('Error getting wallet:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get wallet'
      });
    }
  }

  /**
   * GET /api/credits/transactions/:userId
   * Get user transaction history
   */
  async getTransactions(req: Request, res: Response): Promise<void> {
    try {
      const userId = parseInt(req.params.userId);
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (isNaN(userId)) {
        res.status(400).json({ error: 'Invalid user ID' });
        return;
      }

      const result = await CreditWalletService.getTransactionHistory(userId, limit, offset);

      res.json({
        success: true,
        data: {
          transactions: result.transactions.map(tx => ({
            id: tx.id,
            type: tx.transaction_type,
            amount: Number(tx.amount),
            balanceAfter: Number(tx.balance_after),
            status: tx.status,
            description: tx.description,
            bookingId: tx.booking_id,
            weekId: tx.week_id,
            depositedAt: tx.deposited_at,
            expiresAt: tx.expires_at,
            createdAt: tx.created_at,
            metadata: tx.metadata
          })),
          pagination: {
            total: result.total,
            limit,
            offset,
            hasMore: offset + limit < result.total
          }
        }
      });

    } catch (error: any) {
      console.error('Error getting transactions:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get transactions'
      });
    }
  }

  /**
   * POST /api/credits/deposit
   * Deposit a week for credits
   */
  async depositWeek(req: Request, res: Response): Promise<void> {
    try {
      const { userId, weekId } = req.body;
      const adminUserId = (req as any).user?.id; // From auth middleware

      if (!userId || !weekId) {
        res.status(400).json({ error: 'userId and weekId are required' });
        return;
      }

      const result = await CreditWalletService.depositWeek(
        parseInt(userId),
        parseInt(weekId),
        adminUserId
      );

      res.json({
        success: true,
        data: {
          creditsEarned: result.creditsEarned,
          expiresAt: result.expiresAt,
          wallet: {
            totalBalance: Number(result.wallet.total_balance),
            totalEarned: Number(result.wallet.total_earned)
          },
          transaction: {
            id: result.transaction.id,
            amount: Number(result.transaction.amount),
            createdAt: result.transaction.created_at
          }
        },
        message: `Successfully deposited week #${weekId} for ${result.creditsEarned} credits`
      });

    } catch (error: any) {
      console.error('Error depositing week:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to deposit week'
      });
    }
  }

  /**
   * POST /api/credits/estimate
   * Estimate credits for a week (without depositing)
   */
  async estimateCredits(req: Request, res: Response): Promise<void> {
    try {
      const { propertyId, roomType, weekStartDate } = req.body;

      if (!propertyId || !roomType || !weekStartDate) {
        res.status(400).json({ error: 'propertyId, roomType, and weekStartDate are required' });
        return;
      }

      const estimate = await CreditCalculationService.estimateCreditsForWeek(
        parseInt(propertyId),
        roomType,
        new Date(weekStartDate)
      );

      res.json({
        success: true,
        data: {
          estimatedCredits: estimate.estimatedCredits,
          seasonType: estimate.seasonType,
          breakdown: estimate.breakdown,
          expiresIn: '6 months',
          expirationDate: CreditCalculationService.calculateExpirationDate(new Date())
        }
      });

    } catch (error: any) {
      console.error('Error estimating credits:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to estimate credits'
      });
    }
  }

  /**
   * POST /api/credits/calculate-booking-cost
   * Calculate cost for a booking
   */
  async calculateBookingCost(req: Request, res: Response): Promise<void> {
    try {
      const { propertyId, roomType, checkInDate, checkOutDate } = req.body;

      if (!propertyId || !roomType || !checkInDate || !checkOutDate) {
        res.status(400).json({ error: 'propertyId, roomType, checkInDate, and checkOutDate are required' });
        return;
      }

      const cost = await CreditCalculationService.calculateBookingCost(
        parseInt(propertyId),
        roomType,
        new Date(checkInDate),
        new Date(checkOutDate)
      );

      res.json({
        success: true,
        data: {
          totalCredits: cost.totalCredits,
          nights: cost.nights,
          breakdown: cost.breakdown,
          averagePerNight: Math.round(cost.totalCredits / cost.nights)
        }
      });

    } catch (error: any) {
      console.error('Error calculating booking cost:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to calculate booking cost'
      });
    }
  }

  /**
   * POST /api/credits/check-affordability
   * Check if user can afford a booking
   */
  async checkAffordability(req: Request, res: Response): Promise<void> {
    try {
      const { userId, creditsRequired } = req.body;

      if (!userId || !creditsRequired) {
        res.status(400).json({ error: 'userId and creditsRequired are required' });
        return;
      }

      const result = await CreditWalletService.canAffordBooking(
        parseInt(userId),
        parseFloat(creditsRequired)
      );

      // Calculate hybrid payment if needed
      let hybridPayment = null;
      if (!result.canAfford) {
        hybridPayment = await CreditCalculationService.calculateHybridPayment(
          result.availableBalance,
          parseFloat(creditsRequired)
        );
      }

      res.json({
        success: true,
        data: {
          canAfford: result.canAfford,
          availableBalance: result.availableBalance,
          creditsRequired: parseFloat(creditsRequired),
          shortfall: result.shortfall,
          hybridPayment
        }
      });

    } catch (error: any) {
      console.error('Error checking affordability:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to check affordability'
      });
    }
  }

  /**
   * POST /api/credits/refund
   * Refund credits from cancelled booking
   */
  async refundBooking(req: Request, res: Response): Promise<void> {
    try {
      const { userId, bookingId, creditsToRefund, reason } = req.body;

      if (!userId || !bookingId || !creditsToRefund) {
        res.status(400).json({ error: 'userId, bookingId, and creditsToRefund are required' });
        return;
      }

      const result = await CreditWalletService.refundBooking(
        parseInt(userId),
        parseInt(bookingId),
        parseFloat(creditsToRefund),
        reason
      );

      res.json({
        success: true,
        data: {
          creditsRefunded: result.creditsRefunded,
          wallet: {
            totalBalance: Number(result.wallet.total_balance)
          },
          transaction: {
            id: result.transaction.id,
            createdAt: result.transaction.created_at
          }
        },
        message: `Successfully refunded ${result.creditsRefunded} credits for booking #${bookingId}`
      });

    } catch (error: any) {
      console.error('Error refunding credits:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to refund credits'
      });
    }
  }

  /**
   * POST /api/credits/adjust (admin only)
   * Manual credit adjustment
   */
  async adjustCredits(req: Request, res: Response): Promise<void> {
    try {
      const { userId, amount, reason } = req.body;
      const adminUserId = (req as any).user?.id;

      if (!userId || amount === undefined || !reason) {
        res.status(400).json({ error: 'userId, amount, and reason are required' });
        return;
      }

      if (!adminUserId) {
        res.status(401).json({ error: 'Admin authentication required' });
        return;
      }

      const result = await CreditWalletService.adjustCredits(
        parseInt(userId),
        parseFloat(amount),
        reason,
        adminUserId
      );

      res.json({
        success: true,
        data: {
          adjustment: parseFloat(amount),
          newBalance: Number(result.wallet.total_balance),
          transaction: {
            id: result.transaction.id,
            createdAt: result.transaction.created_at
          }
        },
        message: `Successfully adjusted credits by ${amount} for user #${userId}`
      });

    } catch (error: any) {
      console.error('Error adjusting credits:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to adjust credits'
      });
    }
  }

  /**
   * POST /api/credits/transfer (admin only)
   * Transfer credits between users
   */
  async transferCredits(req: Request, res: Response): Promise<void> {
    try {
      const { fromUserId, toUserId, amount, reason } = req.body;
      const adminUserId = (req as any).user?.id;

      if (!fromUserId || !toUserId || !amount || !reason) {
        res.status(400).json({ error: 'fromUserId, toUserId, amount, and reason are required' });
        return;
      }

      if (!adminUserId) {
        res.status(401).json({ error: 'Admin authentication required' });
        return;
      }

      const result = await CreditWalletService.transferCredits(
        parseInt(fromUserId),
        parseInt(toUserId),
        parseFloat(amount),
        reason,
        adminUserId
      );

      res.json({
        success: true,
        data: {
          transferred: parseFloat(amount),
          fromUser: {
            userId: result.fromWallet.user_id,
            newBalance: Number(result.fromWallet.total_balance)
          },
          toUser: {
            userId: result.toWallet.user_id,
            newBalance: Number(result.toWallet.total_balance)
          },
          transactions: result.transactions.map(tx => ({
            id: tx.id,
            userId: tx.user_id,
            amount: Number(tx.amount)
          }))
        },
        message: `Successfully transferred ${amount} credits from user #${fromUserId} to user #${toUserId}`
      });

    } catch (error: any) {
      console.error('Error transferring credits:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to transfer credits'
      });
    }
  }

  /**
   * GET /api/credits/rate
   * Get current credit to euro conversion rate
   */
  async getConversionRate(req: Request, res: Response): Promise<void> {
    try {
      const rate = await CreditCalculationService.getCreditToEuroRate();

      res.json({
        success: true,
        data: {
          creditToEuroRate: rate,
          oneCredit: `€${rate.toFixed(2)}`,
          oneEuro: `${Math.round(1 / rate)} credits`
        }
      });

    } catch (error: any) {
      console.error('Error getting conversion rate:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to get conversion rate'
      });
    }
  }
}

export default new CreditWalletController();
