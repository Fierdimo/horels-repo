/**
 * requireRole Middleware
 * Restricts access based on user role name
 * Phase 7: Admin Tools
 */

import { Response, NextFunction } from 'express';
import { AuthRequest } from './authMiddleware';
import { Role } from '../models';

/**
 * Middleware to require specific roles
 * @param allowedRoles - Array of allowed role names (e.g., ['admin', 'staff'])
 */
export const requireRole = (allowedRoles: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // Get user's role
      const role = await Role.findByPk(user.role_id);

      if (!role) {
        return res.status(403).json({ error: 'Role not found' });
      }

      // Check if user's role is in allowed roles
      const roleName = role.name.toLowerCase();
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
    } catch (error: any) {
      console.error('Role authorization error:', error);
      return res.status(500).json({
        error: 'Authorization error',
        details: error.message
      });
    }
  };
};
