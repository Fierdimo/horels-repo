/**
 * Admin Property Routes (Phase 7: Admin Tools)
 * Enhanced property management with PMS configuration
 */

import express from 'express';
import PropertyController from '../../controllers/PropertyController';
import { authenticateToken } from '../../middleware/authMiddleware';
import { requireRole } from '../../middleware/requireRole';

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// All routes require admin or staff role
router.use(requireRole(['admin', 'staff']));

// Test new credentials (no property ID required)
router.post('/pms/test-credentials', PropertyController.testNewPMSCredentials.bind(PropertyController));

// List all properties
router.get('/', PropertyController.list.bind(PropertyController));

// Get property by ID
router.get('/:id', PropertyController.getById.bind(PropertyController));

// Create new property
router.post('/', PropertyController.create.bind(PropertyController));

// Update property
router.put('/:id', PropertyController.update.bind(PropertyController));

// Delete (deactivate) property
router.delete('/:id', PropertyController.delete.bind(PropertyController));

// PMS Configuration
router.post('/:id/pms/test', PropertyController.testPMSConnection.bind(PropertyController)); // Test existing config
router.put('/:id/pms', PropertyController.configurePMS.bind(PropertyController)); // Save PMS config
router.delete('/:id/pms', PropertyController.removePMSConfiguration.bind(PropertyController)); // Remove PMS config
router.post('/:id/pms/sync', PropertyController.triggerSync.bind(PropertyController));
router.get('/:id/pms/logs', PropertyController.getSyncLogs.bind(PropertyController));

// Availability check
router.get('/:id/availability', PropertyController.getAvailability.bind(PropertyController));

export default router;
