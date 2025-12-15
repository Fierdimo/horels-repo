import { Request, Response, NextFunction } from 'express';
import LoggingService from '../services/loggingService';

interface AuthRequest extends Request {
  user?: any;
  loggedActions?: Set<string>;
}

/**
 * Middleware to log user actions
 */
export const logAction = (action: string, includeDetails: boolean = false) => {
  return async (req: AuthRequest, res: Response, next: NextFunction) => {
    // Initialize logged actions set if not exists
    if (!req.loggedActions) {
      req.loggedActions = new Set();
    }

    // Log immediately if not already logged for this request
    if (!req.loggedActions!.has(action)) {
      req.loggedActions!.add(action);

      const userId = req.user?.id;
      if (userId) {
        const details = includeDetails ? {
          method: req.method,
          url: req.url,
          statusCode: res.statusCode,
          body: req.body,
          query: req.query,
          params: req.params
        } : undefined;

        LoggingService.logAction({
          user_id: userId,
          action,
          details,
          req
        }).catch(err => console.error('Logging error:', err));
      }
    }

    next();
  };
};

/**
 * Middleware to log API access
 */
export const logApiAccess = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const userId = req.user?.id;

  if (userId) {
    await LoggingService.logAction({
      user_id: userId,
      action: 'api_access',
      details: {
        method: req.method,
        url: req.url,
        userAgent: req.get('User-Agent')
      },
      req
    });
  }

  next();
};

/**
 * Middleware to log authentication events
 */
export const logAuthEvents = async (req: AuthRequest, res: Response, next: NextFunction) => {
  // Store original methods
  const originalJson = res.json;
  const originalStatus = res.status;
  const originalSend = res.send;

  let responseStatus = 200; // Default status
  let responseData: any = null;

  // Override status method to track status code
  res.status = function(code: number) {
    responseStatus = code;
    return originalStatus.call(this, code);
  };

  // Override json method
  res.json = function(data: any) {
    responseData = data;
    return originalJson.call(this, data);
  };

  // Override send method
  res.send = function(data: any) {
    responseData = data;
    return originalSend.call(this, data);
  };

  // Log after response is finished
  res.on('finish', () => {
    try {
      // Log successful login
      if (req.url.includes('/login') && responseStatus === 200 && responseData?.token) {
        LoggingService.logLogin(responseData.user?.id, req).catch(err => console.error('Login logging error:', err));
      }

      // Log failed login
      if (req.url.includes('/login') && (responseStatus === 401 || responseStatus === 400) && responseData?.error) {
        const email = req.body?.email;
        LoggingService.logFailedLogin(email, req).catch(err => console.error('Failed login logging error:', err));
      }

      // Log successful registration
      if (req.url.includes('/register') && responseStatus === 201 && responseData?.userId) {
        LoggingService.logRegistration(responseData.userId, req).catch(err => console.error('Registration logging error:', err));
      }
    } catch (error) {
      console.error('Auth logging middleware error:', error);
    }
  });

  next();
};