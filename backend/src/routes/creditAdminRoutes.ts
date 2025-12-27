import express from 'express';
import { authorizeRole } from '../middleware/authMiddleware';
import CreditAdminController from '../controllers/CreditAdminController';

const router = express.Router();

/**
 * CREDIT ADMIN ROUTES
 * Note: All routes are protected by authenticateToken middleware in app.ts
 * Additional authorizeRole middleware ensures only admins can access
 */

const adminOnly = authorizeRole(['admin', 'super_admin']);

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

// Create seasonal calendar entry
router.post('/seasonal-calendar', adminOnly, CreditAdminController.createSeasonalEntry);

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
