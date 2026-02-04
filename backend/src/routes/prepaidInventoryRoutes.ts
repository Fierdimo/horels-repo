import express from 'express';
import TimeshareAllocationController from '../controllers/TimeshareAllocationController';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * All routes require authentication and admin/staff role
 */
router.use(authenticateToken);
router.use(authorizeRole(['admin', 'staff']));

/**
 * @route   GET /api/admin/prepaid-inventory/stats
 * @desc    Get allocation statistics
 * @access  Admin, Staff
 */
router.get('/stats', (req, res) => 
  TimeshareAllocationController.getStats(req as any, res)
);

/**
 * @route   GET /api/admin/prepaid-inventory
 * @desc    List all allocations with filters
 * @access  Admin, Staff
 * @query   property_id, status, room_type, is_released, expiring_soon, page, limit
 */
router.get('/', (req, res) => 
  TimeshareAllocationController.list(req as any, res)
);

/**
 * @route   GET /api/admin/prepaid-inventory/:id
 * @desc    Get allocation by ID
 * @access  Admin, Staff
 */
router.get('/:id', (req, res) => 
  TimeshareAllocationController.getById(req as any, res)
);

/**
 * @route   POST /api/admin/prepaid-inventory
 * @desc    Create new allocation
 * @access  Admin, Staff
 * @body    property_id, pms_resource_id, room_type, valid_from, valid_until, allocation_type, ...
 */
router.post('/', (req, res) => 
  TimeshareAllocationController.create(req as any, res)
);

/**
 * @route   POST /api/admin/prepaid-inventory/bulk-import
 * @desc    Bulk import allocations from PMS
 * @access  Admin, Staff
 * @body    property_id, resource_ids[], config: {valid_from, valid_until, allocation_type}
 */
router.post('/bulk-import', (req, res) => 
  TimeshareAllocationController.bulkImport(req as any, res)
);

/**
 * @route   PUT /api/admin/prepaid-inventory/:id
 * @desc    Update allocation
 * @access  Admin, Staff
 * @body    Any allocation fields to update
 */
router.put('/:id', (req, res) => 
  TimeshareAllocationController.update(req as any, res)
);

/**
 * @route   POST /api/admin/prepaid-inventory/:id/sync
 * @desc    Sync allocation with PMS
 * @access  Admin, Staff
 */
router.post('/:id/sync', (req, res) => 
  TimeshareAllocationController.syncWithPMS(req as any, res)
);

/**
 * @route   DELETE /api/admin/prepaid-inventory/:id
 * @desc    Delete allocation (soft delete)
 * @access  Admin, Staff
 */
router.delete('/:id', (req, res) => 
  TimeshareAllocationController.delete(req as any, res)
);

export default router;
