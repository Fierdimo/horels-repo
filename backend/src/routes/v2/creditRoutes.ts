/**
 * Credit Routes (V2)
 * 
 * Routes for credit account operations
 * 
 * Base path: /api/v2/credits
 */

import express from 'express';
import { CreditController } from '../../controllers/v2/CreditController';

const router = express.Router();

/**
 * @route   GET /api/v2/credits/balance
 * @desc    Get current credit balance
 * @access  Owner (authenticated)
 */
router.get('/balance', (req, res) => 
  CreditController.getBalance(req as any, res)
);

/**
 * @route   GET /api/v2/credits/transactions
 * @desc    Get transaction history
 * @access  Owner (authenticated)
 * @query   limit (default: 50), offset (default: 0)
 */
router.get('/transactions', (req, res) => 
  CreditController.getTransactions(req as any, res)
);

/**
 * @route   POST /api/v2/credits/purchase
 * @desc    Purchase credits with Stripe (Future - Phase 7)
 * @access  Owner (authenticated)
 */
router.post('/purchase', (req, res) => 
  CreditController.purchaseCredits(req as any, res)
);

export default router;
