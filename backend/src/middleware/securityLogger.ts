import { Request, Response, NextFunction } from 'express';
import LoggingService from '../services/loggingService';

// Log security events using existing LoggingService
export const logSecurityEvent = (action: string, details: any, req: Request) => {
  const ip = req.ip || req.connection.remoteAddress || 'unknown';
  const userAgent = req.get('User-Agent') || 'unknown';

  LoggingService.logAction({
    action: `security_${action}`,
    details: {
      ...details,
      ip,
      userAgent,
      endpoint: req.originalUrl,
      method: req.method,
      timestamp: new Date().toISOString()
    },
    req
  });
};

// Middleware to log failed authentication attempts
export const logFailedAuth = (req: Request, res: Response, next: NextFunction) => {
  // Store original methods
  const originalJson = res.json.bind(res);
  const originalStatus = res.status.bind(res);

  let statusCode = 200;

  // Override status to capture status code
  res.status = function(code: number) {
    statusCode = code;
    return originalStatus(code);
  };

  // Override json to log on response
  res.json = function(data: any) {
    // Log failed auth after response is sent
    if (statusCode === 401 && data.error) {
      logSecurityEvent('auth_failure', {
        reason: data.error,
        email: req.body?.email || 'unknown'
      }, req);
    }
    return originalJson(data);
  };

  next();
};

// Middleware to log suspicious activities
export const logSuspiciousActivity = (req: Request, res: Response, next: NextFunction) => {
  // Log potential SQL injection attempts
  const suspiciousPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /('|(\\x27)|(\\x2D\\x2D)|(\-\-)|(\#)|(\%27)|(\%22)|(\%3B)|(\%3A)|(\%2F)|(\%5C))/i,
    /(<script|javascript:|vbscript:|onload=|onerror=)/i
  ];

  const checkForSuspicious = (obj: any): boolean => {
    if (typeof obj === 'string') {
      return suspiciousPatterns.some(pattern => pattern.test(obj));
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => checkForSuspicious(value));
    }
    return false;
  };

  if (checkForSuspicious(req.body) || checkForSuspicious(req.query) || checkForSuspicious(req.params)) {
    logSecurityEvent('suspicious_activity', {
      type: 'potential_attack',
      data: {
        body: req.body,
        query: req.query,
        params: req.params
      }
    }, req);
  }

  next();
};

// Middleware to validate API keys for external services
export const validateApiKey = (req: Request, res: Response, next: NextFunction) => {
  // For routes that require API key validation
  const apiKey = req.get('X-API-Key');
  const validApiKeys = process.env.VALID_API_KEYS?.split(',') || [];

  if (validApiKeys.length > 0 && !validApiKeys.includes(apiKey || '')) {
    logSecurityEvent('invalid_api_key', {
      providedKey: apiKey ? 'present' : 'missing'
    }, req);
    return res.status(401).json({ error: 'Invalid API key' });
  }

  next();
};

// Middleware to enforce HTTPS in production
export const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  // Skip HTTPS enforcement if explicitly disabled (for HTTP-only deployments)
  if (process.env.REQUIRE_HTTPS === 'false') {
    next();
    return;
  }
  
  if (process.env.NODE_ENV === 'production' && req.get('x-forwarded-proto') !== 'https') {
    logSecurityEvent('http_request_in_production', {}, req);
    return res.status(403).json({ error: 'HTTPS required' });
  }
  next();
};

// Middleware to add security headers for API responses
export const addSecurityHeaders = (req: Request, res: Response, next: NextFunction) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
  });
  next();
};