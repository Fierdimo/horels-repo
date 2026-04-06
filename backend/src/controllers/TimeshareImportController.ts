/**
 * TimeshareImportController
 *
 * Handles the three-file bulk import for timeshare owner data.
 * Accessible by both admin (property from body) and staff (property from session).
 *
 * See: docs_v2/TIMESHARE_BULK_IMPORT.md
 */

import { Response } from 'express';
import multer from 'multer';
import { AuthRequest } from '../middleware/authMiddleware';
import TimeshareImportService, { ImportError } from '../services/TimeshareImportService';

// ── Multer setup ─────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = /\.(xlsx|xls|csv)$/i;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB per file
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_EXTENSIONS.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Only .xlsx, .xls, and .csv files are allowed'));
    }
  },
});

export const uploadFields = upload.fields([
  { name: 'registry_file',     maxCount: 1 },
  { name: 'assignments_file',  maxCount: 1 },
  { name: 'calendar_file',     maxCount: 1 },
]);

// ── Types ────────────────────────────────────────────────────────────────────

interface MulterFiles {
  registry_file?:    Express.Multer.File[];
  assignments_file?: Express.Multer.File[];
  calendar_file?:    Express.Multer.File[];
}

interface AuthRequestWithFiles extends AuthRequest {
  files?: { [fieldname: string]: Express.Multer.File[] } | Express.Multer.File[];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getFiles(req: AuthRequestWithFiles): MulterFiles | null {
  if (!req.files || Array.isArray(req.files)) return null;
  return req.files as unknown as MulterFiles;
}

function fileExt(file: Express.Multer.File): string {
  return file.originalname.split('.').pop()?.toLowerCase() ?? 'xlsx';
}

function resolvePropertyId(req: AuthRequestWithFiles): number | null {
  if (req.user?.role === 'admin') {
    const pid = Number(req.body?.property_id);
    return Number.isFinite(pid) && pid > 0 ? pid : null;
  }
  return req.user?.property_id ?? null;
}

// ── Controller ───────────────────────────────────────────────────────────────

class TimeshareImportController {
  /**
   * POST /api/admin/timeshare-import/preview
   * Parses all three files and returns the first 20 rows each without writing to DB.
   */
  async preview(req: AuthRequestWithFiles, res: Response): Promise<void> {
    try {
      const files = getFiles(req);
      const registryFile    = files?.registry_file?.[0];
      const assignmentsFile = files?.assignments_file?.[0];
      const calendarFile    = files?.calendar_file?.[0];

      if (!registryFile && !assignmentsFile && !calendarFile) {
        res.status(400).json({
          success: false,
          error: 'At least one file is required (registry_file, assignments_file, or calendar_file)',
        });
        return;
      }

      const year = Number(req.body?.season_year) || new Date().getFullYear();
      const data: Record<string, any> = {};

      if (registryFile) {
        const { rows: ownerRows, skipped } = TimeshareImportService.parseOwnerRegistry(
          registryFile.buffer, fileExt(registryFile)
        );
        data.owners = {
          preview: ownerRows.slice(0, 20),
          total:   ownerRows.length,
          skipped_no_email: skipped,
        };
      }

      if (assignmentsFile) {
        const { rows: assignmentRows, errors: assignmentErrors } = TimeshareImportService.parsePeriodSuiteAssignments(
          assignmentsFile.buffer, fileExt(assignmentsFile)
        );
        data.assignments = {
          preview: assignmentRows.slice(0, 20),
          total:   assignmentRows.length,
          errors:  assignmentErrors,
        };
      }

      if (calendarFile) {
        const { map: calendarMap, errors: calendarErrors } = TimeshareImportService.parseCalendar(
          calendarFile.buffer, fileExt(calendarFile), year
        );
        data.calendar = {
          preview: [...calendarMap.values()].slice(0, 20),
          total:   calendarMap.size,
          errors:  calendarErrors,
        };
      }

      res.json({ success: true, data });
    } catch (error: any) {
      console.error('[TimeshareImport] preview error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to parse files',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/admin/timeshare-import/execute
   * Runs the full import and returns an ImportReport.
   */
  async execute(req: AuthRequestWithFiles, res: Response): Promise<void> {
    try {
      const files = getFiles(req);
      const registryFile    = files?.registry_file?.[0];
      const assignmentsFile = files?.assignments_file?.[0];
      const calendarFile    = files?.calendar_file?.[0];

      if (!registryFile && !assignmentsFile && !calendarFile) {
        res.status(400).json({
          success: false,
          error: 'At least one file is required (registry_file, assignments_file, or calendar_file)',
        });
        return;
      }

      const propertyId = resolvePropertyId(req);
      if (!propertyId) {
        res.status(400).json({
          success: false,
          error: req.user?.role === 'admin'
            ? 'property_id is required for admin'
            : 'Your account is not associated with a property',
        });
        return;
      }

      const year = Number(req.body?.season_year);
      if (!year || year < 2000 || year > 2100) {
        res.status(400).json({ success: false, error: 'Valid season_year (e.g. 2025) is required' });
        return;
      }

      const report = await TimeshareImportService.importAll({
        property_id:        propertyId,
        season_year:        year,
        ...(registryFile    && { registry_buffer:    registryFile.buffer,    registry_ext:    fileExt(registryFile) }),
        ...(assignmentsFile && { assignments_buffer: assignmentsFile.buffer, assignments_ext: fileExt(assignmentsFile) }),
        ...(calendarFile    && { calendar_buffer:    calendarFile.buffer,    calendar_ext:    fileExt(calendarFile) }),
      });

      res.json({ success: true, data: report });
    } catch (error: any) {
      console.error('[TimeshareImport] execute error:', error);
      res.status(500).json({
        success: false,
        error: 'Import failed',
        details: error.message,
      });
    }
  }

  /**
   * POST /api/admin/timeshare-import/errors.csv
   * Generates a downloadable CSV of import errors.
   * Body: { errors: ImportError[] }
   */
  async downloadErrors(req: AuthRequest, res: Response): Promise<void> {
    try {
      const errors: ImportError[] = req.body?.errors ?? [];
      const csv = TimeshareImportService.generateErrorCSV(errors);

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="import_errors.csv"');
      res.send(csv);
    } catch (error: any) {
      console.error('[TimeshareImport] downloadErrors error:', error);
      res.status(500).json({ success: false, error: 'Failed to generate error CSV' });
    }
  }
}

export default new TimeshareImportController();
