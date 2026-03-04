import { Router, Request, Response } from 'express';
import { uploadImages } from '../middleware/uploadMiddleware';
import { authorizeRole } from '../middleware/authMiddleware';

const router = Router();

/**
 * POST /api/uploads
 * Upload one or more images (admin or staff only).
 * Body: multipart/form-data, field name "images" (up to 10 files, 5 MB each).
 *
 * Returns: { success: true, urls: string[] }
 */
router.post(
  '/',
  authorizeRole(['admin', 'staff']),
  uploadImages.array('images', 10),
  (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    // Build absolute URLs using the request's own host so it works in any environment
    const baseUrl =
      process.env.BASE_URL ||
      `${req.protocol}://${req.get('host')}`;

    const urls = files.map((f) => `${baseUrl}/uploads/${f.filename}`);

    res.json({ success: true, urls });
  }
);

export default router;
