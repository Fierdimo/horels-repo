/**
 * Admin Ownership Routes
 * Phase 7: Admin Tools
 */

import express from 'express';
import OwnershipController from '../../controllers/OwnershipController';
import { authenticateToken } from '../../middleware/authMiddleware';
import { requireRole } from '../../middleware/requireRole';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// All routes require admin or staff role
router.use(requireRole(['admin', 'staff']));

// Get ownership statistics
router.get('/stats', OwnershipController.getStats.bind(OwnershipController));

// List all ownerships (with filters)
router.get('/', OwnershipController.list.bind(OwnershipController));

// Get ownership by ID
router.get('/:id', OwnershipController.getById.bind(OwnershipController));

// Create new ownership
router.post('/', OwnershipController.create.bind(OwnershipController));

// Update ownership
router.put('/:id', OwnershipController.update.bind(OwnershipController));

// Delete (terminate) ownership
router.delete('/:id', OwnershipController.delete.bind(OwnershipController));

export default router;
