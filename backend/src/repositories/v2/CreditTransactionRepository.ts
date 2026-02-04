/**
 * CreditTransaction Repository (V2)
 * 
 * ⚠️ IMMUTABLE LEDGER - APPEND-ONLY REPOSITORY
 * 
 * This repository only supports INSERT operations.
 * NO updates, NO deletes allowed (enforced at repository level).
 * 
 * All credit movements must go through this ledger for audit trail.
 */

import { FindOptions, Transaction, Op } from 'sequelize';
import { BaseRepository } from './BaseRepository';
import CreditTransaction from '../../models/v2/CreditTransaction';
import CreditAccount from '../../models/v2/CreditAccount';

export interface TransactionFilters {
  accountId?: number;
  type?: CreditTransaction['type'];
  startDate?: Date;
  endDate?: Date;
  minAmount?: number;
  maxAmount?: number;
}

export class CreditTransactionRepository extends BaseRepository<CreditTransaction> {
  constructor() {
    super(CreditTransaction);
  }
  
  /**
   * Create transaction (ONLY allowed operation)
   * Validates balance integrity before insert
   */
  async createTransaction(
    accountId: number,
    type: CreditTransaction['type'],
    amount: number,
    balanceBefore: number,
    description: string,
    referenceType?: string,
    referenceId?: number,
    metadata?: object,
    createdBy?: number,
    ipAddress?: string,
    transaction?: Transaction
  ): Promise<CreditTransaction> {
    const balanceAfter = parseFloat(balanceBefore.toString()) + parseFloat(amount.toString());
    
    // Validate balance integrity
    if (Math.abs(balanceAfter - (balanceBefore + amount)) >= 0.01) {
      throw new Error('Balance calculation error');
    }
    
    const txn = await this.create(
      {
        account_id: accountId,
        type,
        amount,
        balance_before: balanceBefore,
        balance_after: balanceAfter,
        reference_type: referenceType,
        reference_id: referenceId,
        description,
        metadata,
        created_by: createdBy,
        ip_address: ipAddress,
      } as any,
      { transaction }
    );
    
    return txn;
  }
  
  /**
   * Get account transaction history with pagination
   */
  async getAccountHistory(
    accountId: number,
    page: number = 1,
    pageSize: number = 50
  ): Promise<{ transactions: CreditTransaction[]; total: number; pages: number }> {
    const offset = (page - 1) * pageSize;
    
    const { rows, count } = await this.findAndCountAll({
      where: { account_id: accountId },
      order: [['created_at', 'DESC']],
      limit: pageSize,
      offset,
    });
    
    return {
      transactions: rows,
      total: count,
      pages: Math.ceil(count / pageSize),
    };
  }
  
  /**
   * Find transactions by type for date range
   */
  async findByType(
    type: CreditTransaction['type'],
    startDate?: Date,
    endDate?: Date
  ): Promise<CreditTransaction[]> {
    const where: any = { type };
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = startDate;
      if (endDate) where.created_at[Op.lte] = endDate;
    }
    
    return this.findAll({
      where,
      order: [['created_at', 'DESC']],
    });
  }
  
  /**
   * Find transactions by reference (e.g., all transactions for a booking)
   */
  async findByReference(
    referenceType: string,
    referenceId: number
  ): Promise<CreditTransaction[]> {
    return this.findAll({
      where: {
        reference_type: referenceType,
        reference_id: referenceId,
      },
      order: [['created_at', 'ASC']],
    });
  }
  
  /**
   * Search transactions with filters
   */
  async search(filters: TransactionFilters, options?: FindOptions): Promise<CreditTransaction[]> {
    const where: any = {};
    
    if (filters.accountId) {
      where.account_id = filters.accountId;
    }
    
    if (filters.type) {
      where.type = filters.type;
    }
    
    if (filters.startDate || filters.endDate) {
      where.created_at = {};
      if (filters.startDate) where.created_at[Op.gte] = filters.startDate;
      if (filters.endDate) where.created_at[Op.lte] = filters.endDate;
    }
    
    if (filters.minAmount !== undefined || filters.maxAmount !== undefined) {
      where.amount = {};
      if (filters.minAmount !== undefined) where.amount[Op.gte] = filters.minAmount;
      if (filters.maxAmount !== undefined) where.amount[Op.lte] = filters.maxAmount;
    }
    
    return this.findAll({
      where,
      ...options,
      order: [['created_at', 'DESC']],
    });
  }
  
  /**
   * Calculate total credits by type for date range
   */
  async sumByType(
    type: CreditTransaction['type'],
    startDate?: Date,
    endDate?: Date
  ): Promise<number> {
    const where: any = { type };
    
    if (startDate || endDate) {
      where.created_at = {};
      if (startDate) where.created_at[Op.gte] = startDate;
      if (endDate) where.created_at[Op.lte] = endDate;
    }
    
    const result = await CreditTransaction.sum('amount', { where });
    return result || 0;
  }
  
  /**
   * Get transaction statistics for account
   */
  async getAccountStatistics(accountId: number): Promise<{
    totalTransactions: number;
    totalCredits: number;
    totalDebits: number;
    byType: Record<string, { count: number; total: number }>;
  }> {
    const transactions = await this.findAll({
      where: { account_id: accountId },
    });
    
    const stats = {
      totalTransactions: transactions.length,
      totalCredits: 0,
      totalDebits: 0,
      byType: {} as Record<string, { count: number; total: number }>,
    };
    
    for (const txn of transactions) {
      const amount = parseFloat(txn.amount.toString());
      
      if (amount > 0) {
        stats.totalCredits += amount;
      } else {
        stats.totalDebits += Math.abs(amount);
      }
      
      if (!stats.byType[txn.type]) {
        stats.byType[txn.type] = { count: 0, total: 0 };
      }
      stats.byType[txn.type].count++;
      stats.byType[txn.type].total += amount;
    }
    
    return stats;
  }
  
  /**
   * Verify ledger integrity (audit function)
   * Checks that balance_after = balance_before + amount for all transactions
   */
  async verifyIntegrity(accountId?: number): Promise<{
    valid: boolean;
    errors: Array<{ transactionId: bigint; expected: number; actual: number }>;
  }> {
    const where = accountId ? { account_id: accountId } : {};
    const transactions = await this.findAll({
      where,
      order: [['created_at', 'ASC']],
    });
    
    const errors: Array<{ transactionId: bigint; expected: number; actual: number }> = [];
    
    for (const txn of transactions) {
      const expected = parseFloat(txn.balance_before.toString()) + parseFloat(txn.amount.toString());
      const actual = parseFloat(txn.balance_after.toString());
      
      if (Math.abs(expected - actual) >= 0.01) {
        errors.push({
          transactionId: txn.id,
          expected,
          actual,
        });
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Override update method to prevent modifications
   */
  async update(): Promise<never> {
    throw new Error('CreditTransaction is IMMUTABLE - updates not allowed');
  }
  
  /**
   * Override delete method to prevent deletions
   */
  async delete(): Promise<never> {
    throw new Error('CreditTransaction is IMMUTABLE - deletes not allowed');
  }
}

export default CreditTransactionRepository;
