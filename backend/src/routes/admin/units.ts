/**
 * Admin Unit Routes
 * Phase 7: Admin Tools
 */

import express from 'express';
import UnitController from '../../controllers/UnitController';
import { authenticateToken } from '../../middleware/authMiddleware';
import { requireRole } from '../../middleware/requireRole';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// All routes require admin or staff role
router.use(requireRole(['admin', 'staff']));

// List all units (with filters)
router.get('/', UnitController.list.bind(UnitController));

// Get unit by ID
router.get('/:id', UnitController.getById.bind(UnitController));

// Create new unit
router.post('/', UnitController.create.bind(UnitController));

// Bulk create units
router.post('/bulk', UnitController.bulkCreate.bind(UnitController));

// Update unit
router.put('/:id', UnitController.update.bind(UnitController));

// Delete (deactivate) unit
router.delete('/:id', UnitController.delete.bind(UnitController));

export default router;
