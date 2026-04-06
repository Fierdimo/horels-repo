/**
 * Admin Timeshare Import Routes
 *
 * Endpoints for bulk-importing owner, suite, period, and assignment data
 * from three source files (Anagrafica, Periodo e Suite, Calendario).
 *
 * See: docs_v2/TIMESHARE_BULK_IMPORT.md
 */

import express from 'express';
import TimeshareImportController, { uploadFields } from '../../controllers/TimeshareImportController';
import { requireRole } from '../../middleware/requireRole';

const router = express.Router();

// Both admin and staff can run the import
router.use(requireRole(['admin', 'staff']));

/**
 * POST /api/admin/timeshare-import/preview
 * Parse three files and return first 20 rows each (no DB writes)
 */
router.post(
  '/preview',
  uploadFields,
  TimeshareImportController.preview.bind(TimeshareImportController)
);

/**
 * POST /api/admin/timeshare-import/execute
 * Run full import; returns ImportReport
 */
router.post(
  '/execute',
  uploadFields,
  TimeshareImportController.execute.bind(TimeshareImportController)
);

/**
 * POST /api/admin/timeshare-import/errors.csv
 * Generate downloadable CSV from error array in request body
 */
router.post(
  '/errors.csv',
  TimeshareImportController.downloadErrors.bind(TimeshareImportController)
);

export default router;
