import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { User, Role } from '../models';
import UserV2 from '../models/v2/User'; // V2 model

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
    
    // Use V2 model (no Role include needed, role is in user table)
    const user = await UserV2.findByPk(decoded.id);
    if (!user) {
      console.log('❌ User not found for ID:', decoded.id);
      return res.status(401).json({ error: 'User not found' });
    }
    
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
    // V2: role is directly in user object
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'Forbidden: insufficient role' });
    }
    next();
  };
};