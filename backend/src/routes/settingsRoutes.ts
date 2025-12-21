import express from 'express';
import * as settingsController from '../controllers/settingsController';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware';

const router = express.Router();

/**
 * @route   GET /api/settings
 * @desc    Get all platform settings
 * @access  Admin only
 */
router.get(
  '/',
  authenticateToken,
  authorizeRole(['admin']),
  settingsController.getAllSettings
);

/**
 * @route   GET /api/settings/public/swap-fee
 * @desc    Get swap fee (public endpoint)
 * @access  Public (no authentication required)
 */
router.get(
  '/public/swap-fee',
  settingsController.getSwapFee
);

/**
 * @route   GET /api/settings/:key
 * @desc    Get a specific setting by key
 * @access  Admin only
 */
router.get(
  '/:key',
  authenticateToken,
  authorizeRole(['admin']),
  settingsController.getSetting
);

/**
 * @route   PUT /api/settings
 * @desc    Update platform settings (bulk update)
 * @access  Admin only
 */
router.put(
  '/',
  authenticateToken,
  authorizeRole(['admin']),
  settingsController.updateSettings
);

/**
 * @route   PUT /api/settings/:key
 * @desc    Update a single setting
 * @access  Admin only
 */
router.put(
  '/:key',
  authenticateToken,
  authorizeRole(['admin']),
  settingsController.updateSetting
);

/**
 * @route   DELETE /api/settings/:key
 * @desc    Delete a setting
 * @access  Admin only
 */
router.delete(
  '/:key',
  authenticateToken,
  authorizeRole(['admin']),
  settingsController.deleteSetting
);

/**
 * @route   POST /api/settings/reset
 * @desc    Reset all settings to defaults
 * @access  Admin only
 */
router.post(
  '/reset',
  authenticateToken,
  authorizeRole(['admin']),
  settingsController.resetSettings
);

export default router;
