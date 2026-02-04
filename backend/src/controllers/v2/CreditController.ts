/**
 * Credit Controller (V2)
 * 
 * Handles credit account operations:
 * - Get current balance
 * - Get transaction history
 * - (Future) Purchase credits with Stripe
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - API Specification
 */

import { Request, Response } from 'express';
import { CreditService } from '../../services/v2/CreditService';
import { CreditAccountRepository } from '../../repositories/v2/CreditAccountRepository';
import { CreditTransactionRepository } from '../../repositories/v2/CreditTransactionRepository';

// Auth middleware adds user to request
type AuthRequest = Request & {
  user?: {
    id: number;
    email: string;
    role?: string;
  };
};

export class CreditController {
  /**
   * GET /api/v2/credits/balance
   * Get current credit balance for authenticated user
   */
  static async getBalance(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // Initialize service
      const accountRepo = new CreditAccountRepository();
      const transactionRepo = new CreditTransactionRepository();
      const creditService = new CreditService(accountRepo, transactionRepo);

      // Get balance
      const balance = await creditService.getBalance(userId);

      // Get account details
      const account = await accountRepo.findOrCreateForUser(userId);

      res.status(200).json({
        success: true,
        data: {
          balance,
          total_earned: parseFloat((account as any).total_earned || '0'),
          total_spent: parseFloat((account as any).total_spent || '0'),
          total_expired: parseFloat((account as any).total_expired || '0'),
          currency: (account as any).currency || 'EUR',
          expirationPolicy: account.expiration_policy,
          creditLimit: account.credit_limit,
          lastTransactionAt: account.last_transaction_at,
        },
      });
    } catch (error: any) {
      console.error('Error fetching balance:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch balance',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * GET /api/v2/credits/transactions
   * Get transaction history for authenticated user
   */
  static async getTransactions(req: AuthRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      // Pagination
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      // Initialize service
      const accountRepo = new CreditAccountRepository();
      const transactionRepo = new CreditTransactionRepository();
      const creditService = new CreditService(accountRepo, transactionRepo);

      // Get transactions
      const transactions = await creditService.getTransactionHistory(userId, limit, offset);

      // Format response
      const formattedTransactions = transactions.map((tx: any) => ({
        id: tx.id,
        type: tx.type,
        amount: parseFloat(tx.amount),
        balanceBefore: parseFloat(tx.balance_before),
        balanceAfter: parseFloat(tx.balance_after),
        description: tx.description,
        metadata: tx.metadata ? JSON.parse(tx.metadata) : null,
        referenceType: tx.reference_type,
        referenceId: tx.reference_id,
        createdAt: tx.created_at,
      }));

      res.status(200).json({
        success: true,
        data: formattedTransactions,
        meta: {
          limit,
          offset,
          count: formattedTransactions.length,
        },
      });
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to fetch transactions',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  /**
   * POST /api/v2/credits/purchase
   * Purchase credits with Stripe (Future - Phase 7)
   */
  static async purchaseCredits(req: AuthRequest, res: Response): Promise<void> {
    res.status(501).json({ 
      success: false, 
      error: 'Credit purchase not implemented yet. See Phase 7 roadmap.' 
    });
  }
}
