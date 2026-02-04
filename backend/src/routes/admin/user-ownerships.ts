/**
 * Admin User-Ownership Routes
 * Access ownerships through users
 * Phase 7: Admin Tools
 */

import express from 'express';
import OwnershipController from '../../controllers/OwnershipController';
import { authenticateToken } from '../../middleware/authMiddleware';
import { requireRole } from '../../middleware/requireRole';

const router = express.Router();

// All routes require authentication and admin/staff role
router.use(authenticateToken);
router.use(requireRole(['admin', 'staff']));

// Get ownerships by owner
router.get('/:userId/ownerships', OwnershipController.getByOwner.bind(OwnershipController));

export default router;
