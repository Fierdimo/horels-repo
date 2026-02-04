/**
 * CreditAccount Repository (V2)
 * 
 * Data access layer for user credit accounts.
 * Handles balance queries and account management.
 * 
 * ⚠️ IMPORTANT: Never update balance directly
 * Balance should only be updated via CreditService using transactions ledger
 */

import { FindOptions, Transaction } from 'sequelize';
import { BaseRepository } from './BaseRepository';
import CreditAccount from '../../models/v2/CreditAccount';
import CreditTransaction from '../../models/v2/CreditTransaction';

export class CreditAccountRepository extends BaseRepository<CreditAccount> {
  constructor() {
    super(CreditAccount);
  }
  
  /**
   * Find or create account for user (1:1 relationship)
   */
  async findOrCreateForUser(userId: number): Promise<CreditAccount> {
    const [account] = await CreditAccount.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        balance: 0,
        expiration_policy: '2_YEARS',
        total_earned: 0,
        total_spent: 0,
        total_expired: 0,
      } as any,
    });
    
    return account;
  }
  
  /**
   * Get account with transaction history
   */
  async findWithTransactions(
    accountId: number,
    limit: number = 50
  ): Promise<CreditAccount | null> {
    return this.findById(accountId, {
      include: [
        {
          model: CreditTransaction,
          as: 'transactions',
          limit,
          order: [['created_at', 'DESC']],
        },
      ],
    });
  }
  
  /**
   * Get account by user ID
   */
  async findByUserId(userId: number): Promise<CreditAccount | null> {
    return this.findOne({
      where: { user_id: userId },
    });
  }
  
  /**
   * Update balance after transaction
   * ⚠️ Should only be called by CreditService within transaction
   */
  async updateBalance(
    accountId: number,
    newBalance: number,
    transaction?: Transaction
  ): Promise<CreditAccount | null> {
    const account = await this.findById(accountId, { transaction });
    
    if (!account) {
      throw new Error('Credit account not found');
    }
    
    await account.update(
      {
        balance: newBalance,
        last_transaction_at: new Date(),
      },
      { transaction }
    );
    
    return account;
  }
  
  /**
   * Update lifetime totals
   * Called after transaction to maintain aggregate stats
   */
  async updateTotals(
    accountId: number,
    type: 'earned' | 'spent' | 'expired',
    amount: number,
    transaction?: Transaction
  ): Promise<void> {
    const account = await this.findById(accountId, { transaction });
    
    if (!account) {
      throw new Error('Credit account not found');
    }
    
    const updates: any = {};
    
    switch (type) {
      case 'earned':
        updates.total_earned = parseFloat(account.total_earned.toString()) + amount;
        break;
      case 'spent':
        updates.total_spent = parseFloat(account.total_spent.toString()) + Math.abs(amount);
        break;
      case 'expired':
        updates.total_expired = parseFloat(account.total_expired.toString()) + Math.abs(amount);
        break;
    }
    
    await account.update(updates, { transaction });
  }
  
  /**
   * Set credit limit (for VIP/staff accounts)
   */
  async setCreditLimit(
    accountId: number,
    creditLimit: number | null
  ): Promise<CreditAccount | null> {
    return this.update(accountId, { credit_limit: creditLimit } as any);
  }
  
  /**
   * Update expiration policy
   */
  async setExpirationPolicy(
    accountId: number,
    policy: 'NEVER' | '1_YEAR' | '2_YEARS'
  ): Promise<CreditAccount | null> {
    return this.update(accountId, { expiration_policy: policy } as any);
  }
  
  /**
   * Find accounts with low balance (for notifications)
   */
  async findLowBalanceAccounts(threshold: number = 100): Promise<CreditAccount[]> {
    return this.findAll({
      where: {
        balance: { [require('sequelize').Op.lt]: threshold },
      },
    });
  }
  
  /**
   * Get account statistics
   */
  async getAccountStats(accountId: number): Promise<{
    balance: number;
    totalEarned: number;
    totalSpent: number;
    totalExpired: number;
    netCredits: number;
    utilizationRate: number;
  } | null> {
    const account = await this.findById(accountId);
    
    if (!account) {
      return null;
    }
    
    const totalEarned = parseFloat(account.total_earned.toString());
    const totalSpent = parseFloat(account.total_spent.toString());
    const totalExpired = parseFloat(account.total_expired.toString());
    const netCredits = totalEarned - totalSpent - totalExpired;
    const utilizationRate = totalEarned > 0 ? (totalSpent / totalEarned) * 100 : 0;
    
    return {
      balance: parseFloat(account.balance.toString()),
      totalEarned,
      totalSpent,
      totalExpired,
      netCredits,
      utilizationRate,
    };
  }
}

export default CreditAccountRepository;
