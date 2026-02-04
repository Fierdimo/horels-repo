/**
 * Ownership Routes (V2)
 * 
 * Routes for ownership management (admin/owner)
 * 
 * Base path: /api/v2/ownerships
 */

import express from 'express';
import { OwnershipController } from '../../controllers/v2/OwnershipController';
import { authorizeRole } from '../../middleware/authMiddleware';

const router = express.Router();

/**
 * @route   POST /api/v2/ownerships
 * @desc    Create new ownership
 * @access  Admin only
 */
router.post('/', authorizeRole(['admin']), (req, res) => 
  OwnershipController.create(req as any, res)
);

/**
 * @route   GET /api/v2/ownerships/my-ownerships
 * @desc    Get all ownerships for authenticated user
 * @access  Owner (authenticated)
 * @query   activeOnly (default: false)
 */
router.get('/my-ownerships', (req, res) => 
  OwnershipController.getMyOwnerships(req as any, res)
);

/**
 * @route   GET /api/v2/ownerships/:id
 * @desc    Get ownership details
 * @access  Owner or Admin
 * @query   year (optional, default: current year)
 */
router.get('/:id', (req, res) => 
  OwnershipController.getById(req as any, res)
);

/**
 * @route   POST /api/v2/ownerships/:id/transfer
 * @desc    Transfer ownership to another user
 * @access  Admin only
 */
router.post('/:id/transfer', authorizeRole(['admin']), (req, res) => 
  OwnershipController.transfer(req as any, res)
);

/**
 * @route   POST /api/v2/ownerships/:id/terminate
 * @desc    Terminate ownership
 * @access  Admin only
 */
router.post('/:id/terminate', authorizeRole(['admin']), (req, res) => 
  OwnershipController.terminate(req as any, res)
);

export default router;
