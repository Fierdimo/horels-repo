/**
 * Admin Ownership Import Routes
 * Phase 7: Admin Tools
 */

import express from 'express';
import OwnershipImportController from '../../controllers/OwnershipImportController';
import { authenticateToken } from '../../middleware/authMiddleware';
import { requireRole } from '../../middleware/requireRole';

const router = express.Router();

// All routes require authentication and admin role
router.use(authenticateToken);
router.use(requireRole(['admin'])); // Only admins can import

// Get CSV template
router.get('/template', OwnershipImportController.getTemplate.bind(OwnershipImportController));

// Validate CSV
router.post(
  '/validate',
  OwnershipImportController.getUploadMiddleware(),
  OwnershipImportController.validate.bind(OwnershipImportController)
);

// Execute import
router.post(
  '/execute',
  OwnershipImportController.getUploadMiddleware(),
  OwnershipImportController.execute.bind(OwnershipImportController)
);

export default router;
