/**
 * requireRole Middleware
 * Restricts access based on user role name
 * Phase 7: Admin Tools
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';

/**
 * Middleware to require specific roles.
 * Reads role from req.user.role (JWT claim) — no DB lookup needed.
 * @param allowedRoles - Array of allowed role names (e.g., ['admin', 'staff'])
 */
export const requireRole = (allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // role is a string in the JWT payload (e.g. 'admin', 'staff', 'owner')
    const roleName = (user.role || '').toLowerCase();

    if (!roleName) {
      return res.status(403).json({ error: 'Role not found' });
    }

    const isAllowed = allowedRoles.some(
      allowedRole => allowedRole.toLowerCase() === roleName
    );

    if (!isAllowed) {
      return res.status(403).json({
        error: 'Access denied',
        message: `This endpoint requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};
