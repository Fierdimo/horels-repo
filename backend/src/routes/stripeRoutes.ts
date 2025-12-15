
import { Router } from 'express';
import stripeController from '../controllers/stripeController';
import { authenticateToken } from '../middleware/authMiddleware';
import { extraChargeMiddleware } from '../middleware/extraChargeMiddleware';

const router = Router();

// All routes require authentication
router.use(authenticateToken);

// Create payment intent (apply extra charge middleware)
router.post('/intent', extraChargeMiddleware, stripeController.createPaymentIntent.bind(stripeController));

// Confirm payment
router.get('/:paymentIntentId/confirm', stripeController.confirmPayment.bind(stripeController));

// Create refund (admin only - would need role check middleware)
router.post('/refund', stripeController.createRefund.bind(stripeController));

// Cancel payment
router.delete('/:paymentIntentId', stripeController.cancelPayment.bind(stripeController));

// Webhook endpoint (no auth required, uses Stripe signature verification)
// Bind controller methods so `this` is preserved when Express invokes them
router.post('/webhook', stripeController.handleWebhook.bind(stripeController));

export default router;