import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { User, Role } from '../models';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticateToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  
  
  if (!token) {
    console.log('❌ No token provided');
    return res.status(401).json({ error: 'Access token required' });
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    const user = await User.findByPk(decoded.id, { include: Role });
    if (!user) {
      console.log('❌ User not found for ID:', decoded.id);
      return res.status(401).json({ error: 'User not found' });
    }
    
    const userWithRole = user as any;
    req.user = user;
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error);
    return res.status(403).json({ error: 'Invalid token' });
  }
};

export const authorizeRole = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as any).user;
    if (!user || !user.Role || !roles.includes(user.Role.name)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
};