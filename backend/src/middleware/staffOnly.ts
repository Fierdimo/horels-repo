import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to require staff role
 */
export const requireStaffRole = (req: any, res: Response, next: NextFunction) => {
  if (req.user?.Role?.name !== 'staff' && req.user?.role !== 'staff') {
    return res.status(403).json({ error: 'Staff access required' });
  }
  next();
};
