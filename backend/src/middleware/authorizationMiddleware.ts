import { Request, Response, NextFunction } from 'express';
import { User, Role, Permission } from '../models';

interface AuthRequest extends Request {
  user?: any;
}

export const authorize = (requiredPermissions: string[]) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        return res.status(401).json({ error: 'Authentication required' });
      }

      const role = await Role.findByPk(user.role_id, {
        include: [{ model: Permission, as: 'Permissions' }]
      });

      if (!role) {
        return res.status(403).json({ error: 'Role not found' });
      }

      const userPermissions = role.Permissions?.map((p: Permission) => p.name) || [];

      const hasPermission = requiredPermissions.every(perm => userPermissions.includes(perm));

      if (!hasPermission) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }

      next();
    } catch (error) {
      return res.status(500).json({ error: 'Authorization error' });
    }
  };
};