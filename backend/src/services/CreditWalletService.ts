import sequelize from '../config/database';
import UserCreditWallet from '../models/UserCreditWallet';
import CreditTransaction from '../models/CreditTransaction';
import CreditCalculationService from './CreditCalculationService';
import Week from '../models/Week';
import Booking from '../models/Booking';

interface DepositResult {
  transaction: CreditTransaction;
  wallet: UserCreditWallet;
  creditsEarned: number;
  expiresAt: Date;
}

interface SpendResult {
  transactions: CreditTransaction[];
  wallet: UserCreditWallet;
  creditsSpent: number;
  creditsUsed: Array<{ transactionId: number; amount: number; expiresAt: Date }>;
}

interface RefundResult {
  transaction: CreditTransaction;
  wallet: UserCreditWallet;
  creditsRefunded: number;
}

/**
 * Service for managing user credit wallets and transactions
 */
class CreditWalletService {

  /**
   * Deposit a week and earn credits (FIFO expiration tracking)
   */
  async depositWeek(
    userId: number,
    weekId: number,
    adminUserId?: number
  ): Promise<DepositResult> {
    const transaction = await sequelize.transaction();

    try {
      // Calculate credits for this week
      const calculation = await CreditCalculationService.calculateDepositCredits(weekId);
      const creditsEarned = calculation.credits;

      // Get or create wallet with lock
      const wallet = await UserCreditWallet.getWalletWithLock(userId, transaction);

      // Calculate expiration date (6 months)
      const depositedAt = new Date();
      const expiresAt = CreditCalculationService.calculateExpirationDate(depositedAt);

      // Update wallet balance
      const newBalance = Number(wallet.total_balance) + creditsEarned;
      await wallet.update({
        total_balance: newBalance,
        total_earned: Number(wallet.total_earned) + creditsEarned
      }, { transaction });

      // Create deposit transaction
      const creditTransaction = await CreditTransaction.createDeposit(
        userId,
        weekId,
        creditsEarned,
        newBalance,
        expiresAt,
        {
          breakdown: calculation.breakdown,
          depositedBy: adminUserId || userId
        },
        transaction
      );

      // Mark week as deposited
      await Week.update(
        {
          deposited_for_credits: true,
          credits_earned: creditsEarned,
          season_at_deposit: calculation.breakdown.seasonType
        },
        {
          where: { id: weekId },
          transaction
        }
      );

      await transaction.commit();

      return {
        transaction: creditTransaction,
        wallet,
        creditsEarned,
        expiresAt
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Spend credits for a booking (FIFO: oldest credits first)
   */
  async spendCredits(
    userId: number,
    bookingId: number,
    creditsRequired: number
  ): Promise<SpendResult> {
    const transaction = await sequelize.transaction();

    try {
      // Get wallet with lock
      const wallet = await UserCreditWallet.getWalletWithLock(userId, transaction);

      // Check if user has enough credits
      const availableBalance = Number(wallet.total_balance);
      if (availableBalance < creditsRequired) {
        throw new Error(`Insufficient credits. Available: ${availableBalance}, Required: ${creditsRequired}`);
      }

      // Get active credits (FIFO: oldest first)
      const activeCredits = await CreditTransaction.getActiveCredits(userId);

      if (activeCredits.length === 0) {
        throw new Error('No active credits available');
      }

      // Spend credits using FIFO
      let remainingToSpend = creditsRequired;
      const creditsUsed: Array<{ transactionId: number; amount: number; expiresAt: Date }> = [];
      const spendTransactions: CreditTransaction[] = [];

      for (const creditTx of activeCredits) {
        if (remainingToSpend <= 0) break;

        const availableInTx = Number(creditTx.amount);
        const amountToUse = Math.min(availableInTx, remainingToSpend);

        // Mark this transaction as spent
        await creditTx.update({
          status: 'SPENT',
          amount: availableInTx - amountToUse
        }, { transaction });

        creditsUsed.push({
          transactionId: creditTx.id,
          amount: amountToUse,
          expiresAt: creditTx.expires_at!
        });

        remainingToSpend -= amountToUse;
      }

      // Update wallet balance
      const newBalance = Number(wallet.total_balance) - creditsRequired;
      await wallet.update({
        total_balance: newBalance,
        total_spent: Number(wallet.total_spent) + creditsRequired
      }, { transaction });

      // Create spend transaction
      const spendTransaction = await CreditTransaction.createSpend(
        userId,
        bookingId,
        creditsRequired,
        newBalance,
        { creditsUsed },
        transaction
      );

      spendTransactions.push(spendTransaction);

      await transaction.commit();

      return {
        transactions: spendTransactions,
        wallet,
        creditsSpent: creditsRequired,
        creditsUsed
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Refund credits from a cancelled booking
   */
  async refundBooking(
    userId: number,
    bookingId: number,
    creditsToRefund: number,
    reason?: string
  ): Promise<RefundResult> {
    const transaction = await sequelize.transaction();

    try {
      // Get wallet with lock
      const wallet = await UserCreditWallet.getWalletWithLock(userId, transaction);

      // Update wallet balance
      const newBalance = Number(wallet.total_balance) + creditsToRefund;
      await wallet.update({
        total_balance: newBalance,
        total_spent: Number(wallet.total_spent) - creditsToRefund
      }, { transaction });

      // Create refund transaction (non-expiring)
      const refundTransaction = await CreditTransaction.create({
        user_id: userId,
        booking_id: bookingId,
        transaction_type: 'REFUND',
        amount: creditsToRefund,
        balance_after: newBalance,
        status: 'ACTIVE',
        description: reason || `Refund for cancelled booking #${bookingId}`,
        metadata: { refundReason: reason }
      }, { transaction });

      await transaction.commit();

      return {
        transaction: refundTransaction,
        wallet,
        creditsRefunded: creditsToRefund
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Expire old credits (run as scheduled job)
   */
  async expireCredits(): Promise<{
    expiredCount: number;
    totalCreditsExpired: number;
  }> {
    const transaction = await sequelize.transaction();

    try {
      // Get expired credits
      const expiredCredits = await CreditTransaction.getExpiredCredits();

      let totalCreditsExpired = 0;

      for (const creditTx of expiredCredits) {
        const amount = Number(creditTx.amount);
        totalCreditsExpired += amount;

        // Mark as expired
        await creditTx.update({
          status: 'EXPIRED'
        }, { transaction });

        // Get wallet and update
        const wallet = await UserCreditWallet.getWalletWithLock(creditTx.user_id, transaction);
        const newBalance = Number(wallet.total_balance) - amount;

        await wallet.update({
          total_balance: newBalance,
          total_expired: Number(wallet.total_expired) + amount,
          pending_expiration: Math.max(0, Number(wallet.pending_expiration) - amount)
        }, { transaction });

        // Create expiration transaction
        await CreditTransaction.create({
          user_id: creditTx.user_id,
          transaction_type: 'EXPIRATION',
          amount: -amount,
          balance_after: newBalance,
          status: 'EXPIRED',
          description: `Credits expired from transaction #${creditTx.id}`,
          metadata: { originalTransactionId: creditTx.id }
        }, { transaction });
      }

      await transaction.commit();

      return {
        expiredCount: expiredCredits.length,
        totalCreditsExpired
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Update pending expiration amounts for all users
   */
  async updatePendingExpirations(): Promise<void> {
    const transaction = await sequelize.transaction();

    try {
      // Get all wallets
      const wallets = await UserCreditWallet.findAll({ transaction });

      for (const wallet of wallets) {
        // Get credits expiring in next 30 days
        const expiringCredits = await CreditTransaction.getExpiringSoon(wallet.user_id, 30);
        
        const pendingExpiration = expiringCredits.reduce(
          (sum, credit) => sum + Number(credit.amount),
          0
        );

        await wallet.update({ pending_expiration: pendingExpiration }, { transaction });
      }

      await transaction.commit();

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get user wallet summary with expiring credits info
   */
  async getWalletSummary(userId: number): Promise<{
    wallet: UserCreditWallet;
    expiringIn30Days: number;
    expiringIn60Days: number;
    expiringIn90Days: number;
    nextExpirationDate: Date | null;
    activeTransactions: CreditTransaction[];
  }> {
    const wallet = await UserCreditWallet.getOrCreateWallet(userId);
    
    const expiring30 = await CreditTransaction.getExpiringSoon(userId, 30);
    const expiring60 = await CreditTransaction.getExpiringSoon(userId, 60);
    const expiring90 = await CreditTransaction.getExpiringSoon(userId, 90);

    const expiringIn30Days = expiring30.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const expiringIn60Days = expiring60.reduce((sum, tx) => sum + Number(tx.amount), 0);
    const expiringIn90Days = expiring90.reduce((sum, tx) => sum + Number(tx.amount), 0);

    const activeTransactions = await CreditTransaction.getActiveCredits(userId);
    const nextExpirationDate = activeTransactions.length > 0 ? activeTransactions[0].expires_at! : null;

    return {
      wallet,
      expiringIn30Days,
      expiringIn60Days,
      expiringIn90Days,
      nextExpirationDate,
      activeTransactions
    };
  }

  /**
   * Manual adjustment (admin only)
   */
  async adjustCredits(
    userId: number,
    amount: number,
    reason: string,
    adminUserId: number
  ): Promise<{
    transaction: CreditTransaction;
    wallet: UserCreditWallet;
  }> {
    const transaction = await sequelize.transaction();

    try {
      const wallet = await UserCreditWallet.getWalletWithLock(userId, transaction);

      const newBalance = Number(wallet.total_balance) + amount;

      // Update appropriate counter
      const updates: any = { total_balance: newBalance };
      if (amount > 0) {
        updates.total_earned = Number(wallet.total_earned) + amount;
      } else {
        updates.total_spent = Number(wallet.total_spent) + Math.abs(amount);
      }

      await wallet.update(updates, { transaction });

      // Create adjustment transaction
      const adjustmentTx = await CreditTransaction.create({
        user_id: userId,
        transaction_type: 'ADJUSTMENT',
        amount,
        balance_after: newBalance,
        status: amount > 0 ? 'ACTIVE' : 'SPENT',
        description: reason,
        created_by: adminUserId,
        metadata: { adjustedBy: adminUserId, reason }
      }, { transaction });

      await transaction.commit();

      return {
        transaction: adjustmentTx,
        wallet
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Transfer credits between users (admin feature)
   */
  async transferCredits(
    fromUserId: number,
    toUserId: number,
    amount: number,
    reason: string,
    adminUserId: number
  ): Promise<{
    fromWallet: UserCreditWallet;
    toWallet: UserCreditWallet;
    transactions: CreditTransaction[];
  }> {
    const transaction = await sequelize.transaction();

    try {
      // Deduct from source
      const fromWallet = await UserCreditWallet.getWalletWithLock(fromUserId, transaction);
      
      if (Number(fromWallet.total_balance) < amount) {
        throw new Error('Insufficient credits for transfer');
      }

      const fromNewBalance = Number(fromWallet.total_balance) - amount;
      await fromWallet.update({
        total_balance: fromNewBalance,
        total_spent: Number(fromWallet.total_spent) + amount
      }, { transaction });

      // Add to destination
      const toWallet = await UserCreditWallet.getWalletWithLock(toUserId, transaction);
      const toNewBalance = Number(toWallet.total_balance) + amount;
      await toWallet.update({
        total_balance: toNewBalance,
        total_earned: Number(toWallet.total_earned) + amount
      }, { transaction });

      // Create transactions
      const fromTx = await CreditTransaction.create({
        user_id: fromUserId,
        transaction_type: 'ADJUSTMENT',
        amount: -amount,
        balance_after: fromNewBalance,
        status: 'SPENT',
        description: `Transfer to user #${toUserId}: ${reason}`,
        created_by: adminUserId,
        metadata: { transferTo: toUserId, reason }
      }, { transaction });

      const toTx = await CreditTransaction.create({
        user_id: toUserId,
        transaction_type: 'ADJUSTMENT',
        amount: amount,
        balance_after: toNewBalance,
        status: 'ACTIVE',
        description: `Transfer from user #${fromUserId}: ${reason}`,
        created_by: adminUserId,
        metadata: { transferFrom: fromUserId, reason }
      }, { transaction });

      await transaction.commit();

      return {
        fromWallet,
        toWallet,
        transactions: [fromTx, toTx]
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  /**
   * Get transaction history for user
   */
  async getTransactionHistory(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ): Promise<{
    transactions: CreditTransaction[];
    total: number;
  }> {
    const { count, rows } = await CreditTransaction.findAndCountAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit,
      offset
    });

    return {
      transactions: rows,
      total: count
    };
  }

  /**
   * Check if user can afford booking
   */
  async canAffordBooking(
    userId: number,
    creditsRequired: number
  ): Promise<{
    canAfford: boolean;
    availableBalance: number;
    shortfall: number;
  }> {
    const wallet = await UserCreditWallet.getOrCreateWallet(userId);
    const availableBalance = Number(wallet.total_balance);
    const canAfford = availableBalance >= creditsRequired;
    const shortfall = canAfford ? 0 : creditsRequired - availableBalance;

    return {
      canAfford,
      availableBalance,
      shortfall
    };
  }
}

export default new CreditWalletService();
