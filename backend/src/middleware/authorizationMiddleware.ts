import { Request, Response, NextFunction } from 'express';
import { User, Role, Permission } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

// V2 Permission mapping based on role enum
const ROLE_PERMISSIONS: Record<string, string[]> = {
  admin: [
    'view_users',
    'create_user',
    'update_user',
    'delete_user',
    'view_properties',
    'create_property',
    'update_property',
    'delete_property',
    'view_bookings',
    'create_booking',
    'update_booking',
    'cancel_booking',
    'view_credits',
    'manage_credits',
    'view_reports',
    'manage_settings',
    'approve_staff',
  ],
  owner: [
    'view_own_bookings',
    'create_booking',
    'cancel_own_booking',
    'view_own_credits',
    'release_weeks',
    'view_marketplace',
  ],
  staff: [
    'view_property_bookings',
    'create_booking',
    'update_booking',
    'view_property_inventory',
  ],
  guest: [
    'view_marketplace',
    'create_booking',
    'view_own_bookings',
    'cancel_own_booking',
  ],
};

export const authorize = (requiredPermissions: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      // V2: Get role directly from user (enum)
      const userRole = user.role;
      
      if (!userRole) {
        return res.status(403).json({ error: 'User role not found' });
      }

      // Get permissions for this role
      const userPermissions = ROLE_PERMISSIONS[userRole] || [];

      // Check if user has all required permissions
      const hasPermission = requiredPermissions.every(perm => userPermissions.includes(perm));

      if (!hasPermission) {
        console.log(`[Authorization] User ${user.email} (${userRole}) denied. Required: ${requiredPermissions.join(', ')}`);
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      console.error('[Authorization] Error:', error);
      return res.status(500).json({ error: 'Authorization error' });
    }
  };
};