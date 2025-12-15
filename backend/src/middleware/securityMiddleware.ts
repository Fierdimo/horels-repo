import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';

// Security headers middleware
export const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// CORS configuration
export const corsOptions = cors({
  origin: function (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000', // React dev server
      'http://localhost:3001', // Next.js dev server
      'http://localhost:5173', // Next.js dev server
      'https://yourdomain.com', // Production domain
      'capacitor://localhost', // Capacitor mobile apps
      'ionic://localhost', // Ionic mobile apps
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
});

// Rate limiting configurations
export const createRateLimit = (windowMs: number, max: number, message: string) => {
  // Use higher limits for testing
  const isTest = process.env.NODE_ENV === 'test';
  const testMultiplier = isTest ? 100 : 1;

  return rateLimit({
    windowMs,
    max: max * testMultiplier,
    message: {
      error: 'Too many requests',
      message,
      retryAfter: Math.ceil(windowMs / 1000)
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip rate limiting in test environment for easier testing
    skip: (req, res) => isTest
  });
};

// General API rate limit (100 requests per 15 minutes)
export const apiLimiter = createRateLimit(
  15 * 60 * 1000, // 15 minutes
  100,
  'Too many API requests, please try again later'
);

// Authentication rate limit (5 attempts per hour)
export const authLimiter = createRateLimit(
  60 * 60 * 1000, // 1 hour
  5,
  'Too many authentication attempts, please try again later'
);

// Admin actions rate limit (20 requests per minute)
export const adminLimiter = createRateLimit(
  60 * 1000, // 1 minute
  20,
  'Too many admin actions, please slow down'
);

// Input validation middleware
export const validateRequest = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Validation rules for user registration
export const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  body('roleName')
    .optional()
    .isIn(['guest', 'owner', 'staff', 'admin'])
    .withMessage('Invalid role specified')
];

// Validation rules for login
export const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

// Sanitization middleware
export const sanitizeInput = (req: any, res: any, next: any) => {
  // Recursively sanitize string inputs
  const sanitize = (obj: any) => {
    for (let key in obj) {
      if (typeof obj[key] === 'string') {
        // Remove potentially dangerous characters
        obj[key] = obj[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
        obj[key] = obj[key].replace(/<[^>]*>/g, ''); // Remove HTML tags
        obj[key] = obj[key].trim();
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitize(obj[key]);
      }
    }
  };

  if (req.body) sanitize(req.body);
  if (req.query) sanitize(req.query);
  if (req.params) sanitize(req.params);

  next();
};

// GDPR compliance - data minimization middleware
export const dataMinimization = (req: any, res: any, next: any) => {
  // Remove sensitive data from logs
  const originalJson = res.json;
  res.json = function(data: any) {
    // Remove sensitive fields from responses
    const sanitizedData = JSON.parse(JSON.stringify(data));

    const removeSensitive = (obj: any) => {
      if (typeof obj !== 'object' || obj === null) return;

      // Remove sensitive fields, but keep token for auth responses
      const sensitiveFields = ['password', 'creditCard', 'ssn'];
      // Only remove token if it's not an auth response
      if (!req.originalUrl.includes('/auth/')) {
        sensitiveFields.push('token');
      }

      sensitiveFields.forEach(field => {
        if (obj.hasOwnProperty(field)) {
          delete obj[field];
        }
      });

      // Recursively process nested objects
      for (let key in obj) {
        if (typeof obj[key] === 'object') {
          removeSensitive(obj[key]);
        }
      }
    };

    removeSensitive(sanitizedData);
    return originalJson.call(this, sanitizedData);
  };

  next();
};