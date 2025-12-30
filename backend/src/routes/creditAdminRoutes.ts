import express, { Request, Response } from 'express';
import { authorizeRole } from '../middleware/authMiddleware';
import CreditAdminController from '../controllers/CreditAdminController';

const router = express.Router();

/**
 * CREDIT ADMIN ROUTES
 * Note: All routes are protected by authenticateToken middleware in app.ts
 * Additional authorizeRole middleware ensures only admins can access
 */

const adminOnly = authorizeRole(['admin', 'super_admin']);
const adminOrStaff = authorizeRole(['admin', 'super_admin', 'staff']);

/**
 * PROPERTY TIERS
 */

// Get all property tiers
router.get('/tiers', adminOnly, CreditAdminController.getPropertyTiers);

// Update property tier multiplier
router.put('/tiers/:id', adminOnly, CreditAdminController.updatePropertyTier);

// Assign tier to property
router.put('/properties/:id/tier', adminOnly, CreditAdminController.assignPropertyTier);

/**
 * ROOM TYPE MULTIPLIERS
 */

// Get all room type multipliers
router.get('/room-multipliers', adminOnly, CreditAdminController.getRoomMultipliers);

// Update room type multiplier
router.put('/room-multipliers/:id', adminOnly, CreditAdminController.updateRoomMultiplier);

/**
 * SEASONAL CALENDAR
 */

// Get seasonal calendar for property and year
router.get('/seasonal-calendar/:propertyId/:year', adminOnly, CreditAdminController.getSeasonalCalendar);

// Get season for specific date (accessible by staff for invitation creation)
router.get('/seasonal-calendar/:propertyId/season', adminOrStaff, async (req: any, res: Response) => {
  try {
    console.log('🔍 User accessing seasonal calendar:', {
      id: req.user?.id,
      email: req.user?.email,
      role: req.user?.Role?.name,
      hasRole: !!req.user?.Role
    });
    
    const propertyId = parseInt(req.params.propertyId);
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    
    if (isNaN(propertyId)) {
      return res.status(400).json({ success: false, error: 'Invalid propertyId' });
    }

    const SeasonalCalendar = (await import('../models/SeasonalCalendar')).default;
    // Use method with default fallback
    const season = await SeasonalCalendar.getSeasonForDateWithDefault(propertyId, date);
    
    res.json({
      success: true,
      data: {
        season: season, // Always returns a season (configured or default)
        date: date.toISOString().split('T')[0]
      }
    });
  } catch (error: any) {
    console.error('Error getting season for date:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create seasonal calendar entry
router.post('/seasonal-calendar', adminOnly, CreditAdminController.createSeasonalEntry);

// Delete seasonal calendar entry
router.delete('/seasonal-calendar/:id', adminOnly, CreditAdminController.deleteSeasonalEntry);

/**
 * BOOKING COSTS
 */

// Get booking costs for property
router.get('/booking-costs/:propertyId', adminOnly, CreditAdminController.getBookingCosts);

// Update booking costs for property
router.post('/booking-costs/:propertyId', adminOnly, CreditAdminController.updateBookingCosts);

/**
 * PLATFORM SETTINGS
 */

// Get all platform settings
router.get('/settings', adminOnly, CreditAdminController.getSettings);

// Update platform setting
router.put('/settings/:key', adminOnly, CreditAdminController.updateSetting);

/**
 * AUDIT LOG
 */

// Get recent setting changes
router.get('/change-log', adminOnly, CreditAdminController.getChangeLog);

export default router;
