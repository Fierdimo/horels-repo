import express from 'express';
import CreditWalletController from '../controllers/CreditWalletController';

const router = express.Router();

/**
 * CREDIT WALLET ROUTES
 * Note: All routes are protected by authenticateToken middleware in app.ts
 */

// Get current user's wallet summary (uses token)
router.get('/wallet', CreditWalletController.getWallet);

// Get current user's transaction history (uses token)
router.get('/transactions', CreditWalletController.getTransactions);

// Get specific user wallet summary (admin/staff)
router.get('/wallet/:userId', CreditWalletController.getWallet);

// Get specific user transaction history (admin/staff)
router.get('/transactions/:userId', CreditWalletController.getTransactions);

// Deposit week for credits
router.post('/deposit', CreditWalletController.depositWeek);

// Estimate credits for a week (without depositing)
router.post('/estimate', CreditWalletController.estimateCredits);

// Calculate booking cost in credits
router.post('/calculate-booking-cost', CreditWalletController.calculateBookingCost);

// Check if user can afford booking
router.post('/check-affordability', CreditWalletController.checkAffordability);

// Refund credits from cancelled booking
router.post('/refund', CreditWalletController.refundBooking);

// Get credit to euro conversion rate
router.get('/rate', CreditWalletController.getConversionRate);

export default router;
