import { Router } from 'express';
import { ConversionController } from '../controllers/conversionController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();
const conversionController = new ConversionController();

/**
 * @route POST /api/conversion/convert-guest
 * @desc Convert a guest user to owner with payment
 * @access Private (Admin or User themselves)
 */
router.post('/convert-guest', authenticateToken, conversionController.convertGuestToOwner);

/**
 * @route POST /api/conversion/swap-request
 * @desc Create a swap request for a guest
 * @access Private (Admin or Guest themselves)
 */
router.post('/swap-request', authenticateToken, conversionController.createSwapRequest);

/**
 * @route GET /api/conversion/matching-swaps/:propertyId
 * @desc Find matching swaps for a property and dates
 * @access Private (Admin or Staff)
 */
router.get('/matching-swaps/:propertyId', authenticateToken, conversionController.findMatchingSwaps);

/**
 * @route POST /api/conversion/complete-swap
 * @desc Complete a swap with payment
 * @access Private (Admin or Staff)
 */
router.post('/complete-swap', authenticateToken, conversionController.completeSwap);

/**
 * @route GET /api/conversion/swap-fee
 * @desc Calculate swap fee amount
 * @access Private
 */
router.get('/swap-fee', authenticateToken, conversionController.calculateSwapFee);
// Admin-only update endpoint
router.post('/swap-fee', authenticateToken, conversionController.setSwapFee);

export default router;