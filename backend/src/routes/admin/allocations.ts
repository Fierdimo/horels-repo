import express from 'express';
import weekAllocationController from '../../controllers/WeekAllocationController';
import { requireRole } from '../../middleware/requireRole';

const router = express.Router();

/**
 * Week Allocation Routes
 * Requires admin or staff role
 * 
 * POST   /api/admin/allocations/preview  - Preview allocations
 * POST   /api/admin/allocations/generate - Generate allocations
 * GET    /api/admin/allocations          - List allocations
 * DELETE /api/admin/allocations          - Delete allocations
 */

// Preview allocations (no database changes)
router.post('/preview', requireRole(['admin', 'staff']), (req, res) => 
  weekAllocationController.preview(req, res)
);

// Generate allocations (creates records)
router.post('/generate', requireRole(['admin', 'staff']), (req, res) => 
  weekAllocationController.generate(req, res)
);

// List allocations
router.get('/', requireRole(['admin', 'staff']), (req, res) => 
  weekAllocationController.list(req, res)
);

// Delete allocations
router.delete('/', requireRole(['admin']), (req, res) => 
  weekAllocationController.delete(req, res)
);

export default router;
