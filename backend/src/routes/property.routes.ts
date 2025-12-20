import { Router } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import PropertyController from '../controllers/PropertyController';
import { validatePropertyAccess } from '../middleware/propertyAccess';

const router = Router();

// Helper middleware for role requirement
const requireRole = (role: string) => {
  return (req: any, res: any, next: any) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Authentication required' });
    }
    // Get role from user object (can be user.Role.name or user.role from JWT)
    const userRole = req.user.Role?.name || req.user.role;
    if (userRole !== role) {
      return res.status(403).json({ success: false, error: 'Insufficient permissions' });
    }
    next();
  };
};

// All routes require authentication
router.use(authenticateToken);

/**
 * @route   GET /api/properties
 * @desc    List all properties (admin sees all, staff sees only their property)
 * @access  Private (hotel-staff, admin)
 */
router.get(
  '/',
  PropertyController.list
);

/**
 * @route   GET /api/properties/:id
 * @desc    Get property details by ID
 * @access  Private (hotel-staff can only see their property, admin sees all)
 */
router.get(
  '/:id',
  validatePropertyAccess,
  PropertyController.getById
);

/**
 * @route   POST /api/properties
 * @desc    Create a new property
 * @access  Private (admin only)
 */
router.post(
  '/',
  requireRole('admin'),
  PropertyController.create
);

/**
 * @route   PUT /api/properties/:id
 * @desc    Update property details
 * @access  Private (admin can update any, staff can update their own property)
 */
router.put(
  '/:id',
  validatePropertyAccess,
  PropertyController.update
);

/**
 * @route   DELETE /api/properties/:id
 * @desc    Delete a property (soft delete by setting status to 'inactive')
 * @access  Private (admin only)
 */
router.delete(
  '/:id',
  requireRole('admin'),
  PropertyController.delete
);

/**
 * @route   POST /api/properties/:id/pms/test
 * @desc    Test PMS connection with provided credentials (without saving)
 * @access  Private (admin can test any, staff can test their own property)
 */
router.post(
  '/:id/pms/test',
  validatePropertyAccess,
  PropertyController.testPMSConnection
);

/**
 * @route   PUT /api/properties/:id/pms/sync
 * @desc    Trigger manual PMS synchronization
 * @access  Private (admin and hotel-staff for their property)
 */
router.put(
  '/:id/pms/sync',
  validatePropertyAccess,
  PropertyController.triggerSync
);

/**
 * @route   GET /api/properties/:id/pms/logs
 * @desc    Get PMS sync logs for a property
 * @access  Private (admin and hotel-staff for their property)
 */
router.get(
  '/:id/pms/logs',
  validatePropertyAccess,
  PropertyController.getSyncLogs
);

/**
 * @route   GET /api/properties/:id/availability
 * @desc    Get room availability from PMS
 * @access  Private (hotel-staff for their property)
 */
router.get(
  '/:id/availability',
  validatePropertyAccess,
  PropertyController.getAvailability
);

/**
 * @route   PUT /api/properties/:propertyId/rooms/:roomId/color
 * @desc    Assign or update room color (Red/Blue/White) for week assignments
 * @access  Private (staff can update their own property, admin can update any)
 * 
 * Body:
 * {
 *   color: 'red' | 'blue' | 'white'
 * }
 */
router.put(
  '/:propertyId/rooms/:roomId/color',
  authenticateToken,
  requireRole('staff'),
  validatePropertyAccess,
  PropertyController.updateRoomColor
);

export default router;
