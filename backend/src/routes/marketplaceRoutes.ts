import express, { Request, Response } from 'express';
import WeekReleaseService from '../services/WeekReleaseService';
import CreditBookingService from '../services/CreditBookingService';
import InventoryService from '../services/InventoryService';

const router = express.Router();

/**
 * UNIFIED CREDIT MARKETPLACE ROUTES
 * Week Release → Inventory Search → Credit Booking
 * 
 * Authentication: All routes protected by authenticateToken middleware in app.ts
 * User ID extracted from req.user.id
 */

// ==================== WEEK RELEASE ROUTES ====================

/**
 * GET /api/marketplace/weeks/eligible
 * Get user's weeks eligible for release
 */
router.get('/weeks/eligible', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const weeks = await WeekReleaseService.getEligibleWeeks(userId);
    
    return res.json({
      success: true,
      count: weeks.length,
      weeks
    });
  } catch (error: any) {
    console.error('Error fetching eligible weeks:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketplace/weeks/:weekId/estimate
 * Estimate credits for releasing a week
 */
router.post('/weeks/:weekId/estimate', async (req: Request, res: Response) => {
  try {
    const { weekId } = req.params;
    
    const estimate = await WeekReleaseService.estimateReleaseValue(parseInt(weekId));
    
    return res.json({
      success: true,
      estimate
    });
  } catch (error: any) {
    console.error('Error estimating week value:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketplace/weeks/:weekId/release
 * Release a week to inventory and earn credits
 */
router.post('/weeks/:weekId/release', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { weekId } = req.params;
    
    const result = await WeekReleaseService.releaseWeek(parseInt(weekId), userId);
    
    return res.json({
      success: true,
      message: `Week released! Earned ${result.creditsEarned} credits.`,
      ...result
    });
  } catch (error: any) {
    console.error('Error releasing week:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/marketplace/weeks/:weekId/can-release
 * Check if a week can be released
 */
router.post('/weeks/:weekId/can-release', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { weekId } = req.params;
    
    const result = await WeekReleaseService.canRelease(parseInt(weekId), userId);
    
    return res.json({
      success: true,
      ...result
    });
  } catch (error: any) {
    console.error('Error checking release eligibility:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketplace/inventory/:itemId/withdraw
 * Withdraw a week from inventory (get week back, lose credits)
 */
router.post('/inventory/:itemId/withdraw', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { itemId } = req.params;
    
    const result = await WeekReleaseService.withdrawFromInventory(parseInt(itemId), userId);
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error withdrawing from inventory:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

// ==================== INVENTORY SEARCH ROUTES ====================

/**
 * GET /api/marketplace/inventory/search
 * Search available inventory
 * 
 * Query params:
 * - propertyId: number
 * - accommodationType: string
 * - seasonType: RED|WHITE|BLUE
 * - startDate: ISO date
 * - endDate: ISO date
 * - minCredits: number
 * - maxCredits: number
 * - minNights: number
 * - maxNights: number
 * - isFloating: boolean
 * - page: number (default 1)
 * - pageSize: number (default 20)
 */
router.get('/inventory/search', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    
    const filters: any = {
      excludeOwnerId: userId // Don't show user's own weeks
    };

    // Parse query params
    if (req.query.propertyId) {
      filters.propertyId = parseInt(req.query.propertyId as string);
    }
    if (req.query.propertyIds) {
      const ids = (req.query.propertyIds as string).split(',').map(id => parseInt(id));
      filters.propertyIds = ids;
    }
    if (req.query.accommodationType) {
      filters.accommodationType = req.query.accommodationType;
    }
    if (req.query.seasonType) {
      filters.seasonType = req.query.seasonType;
    }
    if (req.query.startDate) {
      filters.startDate = new Date(req.query.startDate as string);
    }
    if (req.query.endDate) {
      filters.endDate = new Date(req.query.endDate as string);
    }
    if (req.query.minCredits) {
      filters.minCredits = parseInt(req.query.minCredits as string);
    }
    if (req.query.maxCredits) {
      filters.maxCredits = parseInt(req.query.maxCredits as string);
    }
    if (req.query.minNights) {
      filters.minNights = parseInt(req.query.minNights as string);
    }
    if (req.query.maxNights) {
      filters.maxNights = parseInt(req.query.maxNights as string);
    }
    if (req.query.isFloating !== undefined) {
      filters.isFloating = req.query.isFloating === 'true';
    }

    const page = req.query.page ? parseInt(req.query.page as string) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string) : 20;

    const results = await InventoryService.search(filters, page, pageSize);
    
    return res.json({
      success: true,
      ...results
    });
  } catch (error: any) {
    console.error('Error searching inventory:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketplace/inventory/:itemId
 * Get inventory item details
 */
router.get('/inventory/:itemId', async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    
    const item = await InventoryService.getById(parseInt(itemId));
    
    if (!item) {
      return res.status(404).json({ error: 'Inventory item not found' });
    }
    
    return res.json({
      success: true,
      item
    });
  } catch (error: any) {
    console.error('Error fetching inventory item:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketplace/inventory/stats
 * Get inventory statistics
 */
router.get('/inventory/stats', async (req: Request, res: Response) => {
  try {
    const stats = await InventoryService.getStats();
    
    return res.json({
      success: true,
      stats: {
        ...stats,
        byProperty: Object.fromEntries(stats.byProperty),
        bySeason: Object.fromEntries(stats.bySeason)
      }
    });
  } catch (error: any) {
    console.error('Error fetching inventory stats:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/marketplace/my-inventory
 * Get user's items in inventory
 */
router.get('/my-inventory', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const includeWithdrawn = req.query.includeWithdrawn === 'true';
    
    const items = await InventoryService.getOwnerInventory(userId, includeWithdrawn);
    
    return res.json({
      success: true,
      count: items.length,
      items
    });
  } catch (error: any) {
    console.error('Error fetching user inventory:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ==================== BOOKING ROUTES ====================

/**
 * POST /api/marketplace/inventory/:itemId/payment-options
 * Calculate payment options for booking an item
 */
router.post('/inventory/:itemId/payment-options', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { itemId } = req.params;
    
    const options = await CreditBookingService.calculatePaymentOptions(
      userId,
      parseInt(itemId)
    );
    
    return res.json({
      success: true,
      ...options
    });
  } catch (error: any) {
    console.error('Error calculating payment options:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/marketplace/inventory/:itemId/preview
 * Preview booking details before confirming
 */
router.post('/inventory/:itemId/preview', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { itemId } = req.params;
    
    const preview = await CreditBookingService.previewBooking(
      userId,
      parseInt(itemId)
    );
    
    return res.json({
      success: true,
      ...preview
    });
  } catch (error: any) {
    console.error('Error previewing booking:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/marketplace/inventory/:itemId/reserve
 * Temporarily reserve an item (15 minutes)
 */
router.post('/inventory/:itemId/reserve', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { itemId } = req.params;
    const { expiresInMinutes = 15 } = req.body;
    
    const result = await InventoryService.reserve(
      parseInt(itemId),
      userId,
      expiresInMinutes
    );
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    return res.json({
      success: true,
      message: 'Item reserved temporarily',
      expiresAt: result.expiresAt
    });
  } catch (error: any) {
    console.error('Error reserving item:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/marketplace/inventory/:itemId/release-reservation
 * Release a temporary reservation
 */
router.post('/inventory/:itemId/release-reservation', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { itemId } = req.params;
    
    const released = await InventoryService.releaseReservation(
      parseInt(itemId),
      userId
    );
    
    return res.json({
      success: released,
      message: released ? 'Reservation released' : 'Could not release reservation'
    });
  } catch (error: any) {
    console.error('Error releasing reservation:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * POST /api/marketplace/book
 * Book an inventory item with credits
 * 
 * Body:
 * {
 *   inventoryItemId: number,
 *   paymentType: 'credits_only' | 'credits_plus_cash',
 *   creditsToUse: number,
 *   cashAmount?: number,
 *   stripePaymentMethodId?: string
 * }
 */
router.post('/book', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const bookingRequest = {
      ...req.body,
      ownerId: userId
    };
    
    const result = await CreditBookingService.bookWithCredits(bookingRequest);
    
    return res.json({
      success: true,
      message: 'Booking confirmed!',
      data: {
        bookingId: result.booking.id,
        creditsUsed: result.creditsUsed,
        cashPaid: result.cashPaid,
        walletBalance: result.walletBalanceAfter
      }
    });
  } catch (error: any) {
    console.error('Error creating booking:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

/**
 * GET /api/marketplace/my-bookings
 * Get user's credit marketplace bookings
 */
router.get('/my-bookings', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    
    const bookings = await CreditBookingService.getUserCreditBookings(userId);
    
    return res.json({
      success: true,
      count: bookings.length,
      bookings
    });
  } catch (error: any) {
    console.error('Error fetching user bookings:', error);
    return res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/marketplace/bookings/:bookingId/cancel
 * Cancel a booking and refund credits
 * 
 * Body:
 * {
 *   reason: string
 * }
 */
router.post('/bookings/:bookingId/cancel', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { bookingId } = req.params;
    const { reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ error: 'Cancellation reason required' });
    }
    
    const result = await CreditBookingService.cancelBooking(
      parseInt(bookingId),
      userId,
      reason
    );
    
    return res.json(result);
  } catch (error: any) {
    console.error('Error cancelling booking:', error);
    return res.status(400).json({ 
      success: false,
      error: error.message 
    });
  }
});

export default router;
