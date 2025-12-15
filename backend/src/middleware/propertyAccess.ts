import { Request, Response, NextFunction } from 'express';

/**
 * Middleware to validate property access
 * - Admin users can access any property
 * - Hotel staff can only access their assigned property
 * - Guests cannot access property management endpoints
 */
export const validatePropertyAccess = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const user = (req as any).user;
    const propertyId = req.params.id;

    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
      return;
    }

    // Get role from user object (can be user.Role.name or user.role from JWT)
    const userRole = user.Role?.name || user.role;

    // Admin can access all properties
    if (userRole === 'admin') {
      next();
      return;
    }

    // Hotel staff can only access their assigned property
    if (userRole === 'staff') {
      if (!user.property_id) {
        res.status(403).json({
          success: false,
          error: 'No property assigned to your account'
        });
        return;
      }

      if (user.property_id.toString() !== propertyId) {
        res.status(403).json({
          success: false,
          error: 'Access denied: You can only access your assigned property'
        });
        return;
      }

      next();
      return;
    }

    // Guests and other roles cannot access property management
    res.status(403).json({
      success: false,
      error: 'Insufficient permissions to access property management'
    });
  } catch (error) {
    console.error('Error in validatePropertyAccess middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Middleware to add property filter to query for hotel staff
 * Admin sees all data, hotel staff sees only their property's data
 */
export const addPropertyFilter = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const user = (req as any).user;

    // Get role from user object (can be user.Role.name or user.role from JWT)
    const userRole = user.Role?.name || user.role;

    // Add property filter to request for hotel staff
    if (userRole === 'staff' && user.property_id) {
      (req as any).propertyFilter = {
        property_id: user.property_id
      };
    }

    next();
  } catch (error) {
    console.error('Error in addPropertyFilter middleware:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

export default {
  validatePropertyAccess,
  addPropertyFilter
};
