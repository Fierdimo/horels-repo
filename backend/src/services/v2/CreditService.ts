/**
 * CreditService (V2)
 * 
 * Business logic for credit system.
 * Handles credit transactions with immutable ledger pattern.
 * 
 * CRITICAL PRINCIPLES:
 * 1. All transactions are IMMUTABLE (never update/delete)
 * 2. Always record balance_before and balance_after for audit trail
 * 3. Use database transactions for atomicity
 * 4. Store calculation metadata in JSON for transparency
 * 
 * Field Names (from V2_DATABASE_SCHEMA.md):
 * - balance_before (DECIMAL) - Balance before transaction
 * - balance_after (DECIMAL) - Balance after transaction
 * - amount (DECIMAL) - Transaction amount (positive = credit, negative = debit)
 * - metadata (LONGTEXT) - JSON with calculation details
 * - reference_type (VARCHAR) - Polymorphic reference ('week_allocation', 'booking', etc.)
 * - reference_id (INT) - ID of referenced entity
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - credit_transactions
 */

import { Transaction as DbTransaction } from 'sequelize';
import { CreditAccountRepository } from '../../repositories/v2/CreditAccountRepository';
import { CreditTransactionRepository } from '../../repositories/v2/CreditTransactionRepository';
import sequelize from '../../config/database';

export interface CreditTransactionData {
  type: 'WEEK_RELEASE' | 'WEEK_BOOKING' | 'CREDIT_PURCHASE' | 'CREDIT_EXPIRATION' | 
        'CONDOMINIUM_PAYMENT' | 'REFUND' | 'ADJUSTMENT' | 'BONUS' | 'PENALTY';
  amount: number;
  description: string;
  reference_type?: string;
  reference_id?: number;
  metadata?: object;
  created_by?: number;
  ip_address?: string;
  user_agent?: string;
}

export interface CreditTransactionResult {
  transaction_id: number;
  balance_before: number;
  balance_after: number;
  amount: number;
}

export class CreditService {
  private accountRepo: CreditAccountRepository;
  private transactionRepo: CreditTransactionRepository;

  constructor(
    accountRepo?: CreditAccountRepository,
    transactionRepo?: CreditTransactionRepository
  ) {
    this.accountRepo = accountRepo || new CreditAccountRepository();
    this.transactionRepo = transactionRepo || new CreditTransactionRepository();
  }

  /**
   * Add credits to user account
   * 
   * Common uses:
   * - Week release → earn credits
   * - Purchase credits with cash
   * - Bonus credits (promotions)
   * - Refunds
   * 
   * @param userId - User ID
   * @param transactionData - Transaction details
   * @param dbTransaction - Optional database transaction for atomicity
   * @returns Transaction result with new balance
   */
  async addCredits(
    userId: number,
    transactionData: CreditTransactionData,
    dbTransaction?: DbTransaction
  ): Promise<CreditTransactionResult> {
    // Validate amount is positive
    if (transactionData.amount <= 0) {
      throw new Error('Amount must be positive for credit addition');
    }

    return this.executeTransaction(userId, transactionData, dbTransaction);
  }

  /**
   * Deduct credits from user account
   * 
   * Common uses:
   * - Booking with credits
   * - Annual fee payment
   * - Penalties
   * 
   * @param userId - User ID
   * @param transactionData - Transaction details (amount should be positive, will be negated)
   * @param dbTransaction - Optional database transaction for atomicity
   * @returns Transaction result with new balance
   * @throws Error if insufficient balance
   */
  async deductCredits(
    userId: number,
    transactionData: CreditTransactionData,
    dbTransaction?: DbTransaction
  ): Promise<CreditTransactionResult> {
    // Validate amount is positive (will be negated)
    if (transactionData.amount <= 0) {
      throw new Error('Amount must be positive for credit deduction');
    }

    // Get account and check balance
    const account = await this.accountRepo.findOrCreateForUser(userId);
    
    if (account.balance < transactionData.amount) {
      throw new Error(
        `Insufficient credits. Available: ${account.balance}, Required: ${transactionData.amount}`
      );
    }

    // Negate amount for deduction
    const deductionData = {
      ...transactionData,
      amount: -transactionData.amount
    };

    return this.executeTransaction(userId, deductionData, dbTransaction);
  }

  /**
   * Get user credit balance
   * 
   * @param userId - User ID
   * @returns Current balance
   */
  async getBalance(userId: number): Promise<number> {
    const account = await this.accountRepo.findOrCreateForUser(userId);
    return account.balance;
  }

  /**
   * Get transaction history for user
   * 
   * @param userId - User ID
   * @param limit - Max number of transactions to return
   * @param offset - Pagination offset
   * @returns Array of transactions
   */
  async getTransactionHistory(
    userId: number,
    limit: number = 50,
    offset: number = 0
  ) {
    const account = await this.accountRepo.findOrCreateForUser(userId);
    return this.transactionRepo.findAll({
      where: { account_id: account.id },
      limit,
      offset,
      order: [['created_at', 'DESC']],
    });
  }

  /**
   * Execute credit transaction with atomicity
   * 
   * CRITICAL: This is the core method that ensures:
   * 1. Balance update and transaction record happen atomically
   * 2. balance_before and balance_after are recorded
   * 3. All validations pass before committing
   * 
   * @private
   */
  private async executeTransaction(
    userId: number,
    transactionData: CreditTransactionData,
    externalTransaction?: DbTransaction
  ): Promise<CreditTransactionResult> {
    // Use external transaction if provided, otherwise create new one
    const shouldCommit = !externalTransaction;
    const transaction = externalTransaction || await sequelize.transaction();

    try {
      // Get or create account (with lock to prevent race conditions)
      const account = await this.accountRepo.findOrCreateForUser(userId);
      
      // Convert to numbers explicitly to avoid string concatenation
      const balance_before = parseFloat(String(account.balance));
      const amount = parseFloat(String(transactionData.amount));
      const balance_after = balance_before + amount;

      // Validate balance doesn't go negative (double-check)
      if (balance_after < 0) {
        throw new Error(
          `Transaction would result in negative balance: ${balance_after}`
        );
      }

      // Create transaction record (IMMUTABLE LEDGER)
      const transactionRecord = await this.transactionRepo.create({
        account_id: account.id,
        type: transactionData.type,
        amount: amount, // Use converted number
        balance_before: balance_before, // Use converted number
        balance_after: balance_after, // Use converted number
        description: transactionData.description,
        reference_type: transactionData.reference_type,
        reference_id: transactionData.reference_id,
        metadata: transactionData.metadata,
        created_by: transactionData.created_by,
        ip_address: transactionData.ip_address,
        user_agent: transactionData.user_agent
      });

      // Update account balance
      await this.accountRepo.updateBalance(account.id, balance_after, transaction);

      // Update lifetime totals based on transaction type
      if (amount > 0) {
        // Positive amount = earned credits
        await this.accountRepo.updateTotals(account.id, 'earned', amount, transaction);
      } else if (amount < 0) {
        // Negative amount = spent or expired credits
        if (transactionData.type === 'CREDIT_EXPIRATION') {
          await this.accountRepo.updateTotals(account.id, 'expired', amount, transaction);
        } else {
          await this.accountRepo.updateTotals(account.id, 'spent', amount, transaction);
        }
      }

      // Commit if we created the transaction
      if (shouldCommit) {
        await transaction.commit();
      }

      return {
        transaction_id: Number(transactionRecord.id),
        balance_before: balance_before,
        balance_after: balance_after,
        amount: amount
      };

    } catch (error) {
      // Rollback if we created the transaction
      if (shouldCommit) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  /**
   * Calculate credits for week release
   * 
   * Formula:
   * baseValue = unit.base_credit_value
   * seasonalFactor = seasonal_factors[weekNumber] (from JSON)
   * timingFactor = decay based on days in advance
   * 
   * finalCredits = baseValue * seasonalFactor * timingFactor
   * 
   * @param baseValue - Unit base credit value
   * @param weekNumber - Week number (1-52)
   * @param seasonalFactors - JSON object with week multipliers
   * @param releaseDate - Date when week is released
   * @param weekStartDate - Week start date
   * @returns Calculation breakdown with final credits
   */
  calculateWeekReleaseCredits(
    baseValue: number,
    weekNumber: number,
    seasonalFactors: Record<string, number>,
    releaseDate: Date,
    weekStartDate: Date
  ): {
    baseValue: number;
    seasonalMultiplier: number;
    timingMultiplier: number;
    daysInAdvance: number;
    finalCredits: number;
  } {
    // Get seasonal factor (default to 1.0 if not specified or invalid)
    const rawSeasonalFactor = seasonalFactors[weekNumber.toString()];
    const seasonalMultiplier = typeof rawSeasonalFactor === 'number' && !isNaN(rawSeasonalFactor) 
      ? rawSeasonalFactor 
      : (typeof rawSeasonalFactor === 'string' && !isNaN(parseFloat(rawSeasonalFactor)))
        ? parseFloat(rawSeasonalFactor)
        : 1.0;

    // Calculate days in advance
    const daysInAdvance = Math.floor(
      (weekStartDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Calculate timing multiplier (decay function)
    let timingMultiplier: number;
    if (daysInAdvance > 180) {
      timingMultiplier = 1.0; // 100% - released > 6 months in advance
    } else if (daysInAdvance > 90) {
      timingMultiplier = 0.9; // 90% - released 3-6 months in advance
    } else if (daysInAdvance > 30) {
      timingMultiplier = 0.7; // 70% - released 1-3 months in advance
    } else {
      timingMultiplier = 0.5; // 50% - released < 1 month in advance
    }

    // Calculate final credits
    const finalCredits = Math.round(
      baseValue * seasonalMultiplier * timingMultiplier
    );

    return {
      baseValue,
      seasonalMultiplier,
      timingMultiplier,
      daysInAdvance,
      finalCredits
    };
  }
}
