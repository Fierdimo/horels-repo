/**
 * OwnershipImportController
 * Handles CSV import operations for ownerships
 * Phase 7: Admin Tools
 */

import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import OwnershipImportService from '../services/OwnershipImportService';
import multer from 'multer';

// Extend AuthRequest to include multer file
interface AuthRequestWithFile extends AuthRequest {
  file?: Express.Multer.File;
}

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: (req: any, file: any, cb: any) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'));
    }
  }
});

class OwnershipImportController {
  /**
   * Get CSV template
   * GET /api/admin/ownerships/import/template
   */
  async getTemplate(req: AuthRequest, res: Response): Promise<void> {
    try {
      const template = OwnershipImportService.generateTemplate();

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="ownership_import_template.csv"');
      res.send(template);
    } catch (error: any) {
      console.error('Error generating template:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate template',
        details: error.message
      });
    }
  }

  /**
   * Validate CSV file
   * POST /api/admin/ownerships/import/validate
   */
  async validate(req: AuthRequestWithFile, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No CSV file uploaded'
        });
        return;
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const validation = await OwnershipImportService.validateCSV(csvContent);

      res.json({
        success: true,
        data: validation
      });
    } catch (error: any) {
      console.error('Error validating CSV:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to validate CSV',
        details: error.message
      });
    }
  }

  /**
   * Execute import
   * POST /api/admin/ownerships/import/execute
   */
  async execute(req: AuthRequestWithFile, res: Response): Promise<void> {
    try {
      if (!req.file) {
        res.status(400).json({
          success: false,
          error: 'No CSV file uploaded'
        });
        return;
      }

      const csvContent = req.file.buffer.toString('utf-8');
      const { createUsers = false, skipInvalid = false } = req.body;

      const result = await OwnershipImportService.importCSV(csvContent, {
        createUsers: createUsers === 'true' || createUsers === true,
        skipInvalid: skipInvalid === 'true' || skipInvalid === true
      });

      if (result.success) {
        res.json({
          success: true,
          data: result,
          message: `Successfully imported ${result.created} ownerships`
        });
      } else {
        res.status(400).json({
          success: false,
          data: result,
          message: `Import completed with errors. ${result.created} created, ${result.failed} failed.`
        });
      }
    } catch (error: any) {
      console.error('Error executing import:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to execute import',
        details: error.message
      });
    }
  }

  /**
   * Get multer middleware
   */
  getUploadMiddleware() {
    return upload.single('file');
  }
}

export default new OwnershipImportController();
