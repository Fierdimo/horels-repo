/**
 * Week Release Routes (V2)
 * 
 * Routes for week release operations (owner-facing)
 * 
 * Base path: /api/v2/weeks
 */

import express from 'express';
import { WeekReleaseController } from '../../controllers/v2/WeekReleaseController';

const router = express.Router();

/**
 * @route   POST /api/v2/weeks/release
 * @desc    Release a week to marketplace and earn credits
 * @access  Owner (authenticated)
 */
router.post('/release', (req, res) => 
  WeekReleaseController.releaseWeek(req as any, res)
);

/**
 * @route   GET /api/v2/weeks/my-weeks
 * @desc    Get all weeks for authenticated user
 * @access  Owner (authenticated)
 * @query   year (optional, default: current year)
 */
router.get('/my-weeks', (req, res) => 
  WeekReleaseController.getMyWeeks(req as any, res)
);

/**
 * @route   POST /api/v2/weeks/:id/preview-release
 * @desc    Preview credit calculation before releasing
 * @access  Owner (authenticated)
 */
router.post('/:id/preview-release', (req, res) => 
  WeekReleaseController.previewRelease(req as any, res)
);

export default router;
