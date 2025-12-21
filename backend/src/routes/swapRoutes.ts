import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorize } from '../middleware/authorizationMiddleware';
import { requireOwnerRole } from '../middleware/ownerOnly';
import { logAction } from '../middleware/loggingMiddleware';
import SwapController from '../controllers/swapController';

const router = Router();

/**
 * OWNER ROUTES - Week swap management
 */

/**
 * Search for compatible weeks available for swap
 * GET /owner/swaps/compatible-weeks/:weekId
 */
router.get(
  '/compatible-weeks/:weekId',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('search_compatible_weeks'),
  (req: any, res: Response) => SwapController.searchCompatibleWeeks(req, res)
);

/**
 * Create a new swap request
 * POST /owner/swaps
 * Body: { weekId, responderWeekId?, desiredStartDate?, desiredEndDate?, notes? }
 */
router.post(
  '/',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('create_swap_request'),
  (req: any, res: Response) => SwapController.createSwapRequest(req, res)
);

/**
 * Get available swaps to browse and accept
 * GET /owner/swaps/browse/available
 */
router.get(
  '/browse/available',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('browse_available_swaps'),
  (req: any, res: Response) => SwapController.getAvailableSwaps(req, res)
);

/**
 * Get all swap requests for current owner
 * GET /owner/swaps
 * Query: role? = 'requester' | 'responder' | 'both'
 */
router.get(
  '/',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('view_swaps'),
  (req: any, res: Response) => SwapController.getOwnerSwaps(req, res)
);

/**
 * Get swap request details
 * GET /owner/swaps/:swapId
 */
router.get(
  '/:swapId',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('view_swap_details'),
  (req: any, res: Response) => SwapController.getSwapDetails(req, res)
);

/**
 * Accept a swap request (as responder)
 * POST /owner/swaps/:swapId/accept
 */
router.post(
  '/:swapId/accept',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('accept_swap'),
  (req: any, res: Response) => SwapController.acceptSwap(req, res)
);

/**
 * Reject a swap request (as responder)
 * POST /owner/swaps/:swapId/reject
 */
router.post(
  '/:swapId/reject',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('reject_swap'),
  (req: any, res: Response) => SwapController.rejectSwap(req, res)
);

/**
 * Create a Stripe payment intent for the swap fee
 * POST /owner/swaps/:swapId/payment-intent
 */
router.post(
  '/:swapId/payment-intent',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('create_swap_payment'),
  (req: any, res: Response) => SwapController.createPaymentIntent(req, res)
);

/**
 * Confirm payment and complete the swap
 * POST /owner/swaps/:swapId/confirm-payment
 * Body: { paymentIntentId }
 */
router.post(
  '/:swapId/confirm-payment',
  authenticateToken,
  requireOwnerRole,
  authorize(['view_own_weeks']),
  logAction('complete_swap_payment'),
  (req: any, res: Response) => SwapController.confirmPayment(req, res)
);

export default router;
