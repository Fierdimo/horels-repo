import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Request, Response, NextFunction } from 'express';
import {
  logSecurityEvent,
  logFailedAuth,
  logSuspiciousActivity,
  validateApiKey,
  enforceHttps,
  addSecurityHeaders
} from '../src/middleware/securityLogger';
import LoggingService from '../src/services/loggingService';

// Mock LoggingService
vi.mock('../src/services/loggingService', () => ({
  default: {
    logAction: vi.fn()
  }
}));

describe('Security Logger Middleware', () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      ip: '127.0.0.1',
      get: vi.fn((header: string) => {
        if (header === 'User-Agent') return 'test-agent';
        return undefined;
      }),
      originalUrl: '/test',
      method: 'GET',
      body: {},
      query: {},
      params: {}
    };

    mockRes = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      set: vi.fn()
    };

    mockNext = vi.fn();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('logSecurityEvent', () => {
    it('should log security event with correct details', () => {
      logSecurityEvent('test_action', { test: 'data' }, mockReq as Request);

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'security_test_action',
        details: expect.objectContaining({
          test: 'data',
          ip: '127.0.0.1',
          userAgent: 'test-agent',
          endpoint: '/test',
          method: 'GET',
          timestamp: expect.any(String)
        }),
        req: mockReq
      });
    });
  });

  describe('logFailedAuth', () => {
    it('should log failed authentication when status is 401', () => {
      logFailedAuth(mockReq as Request, mockRes as Response, mockNext);

      // Simulate auth failure response
      mockRes.status(401);
      mockRes.json({ error: 'Invalid credentials' });

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'security_auth_failure',
        details: expect.objectContaining({
          reason: 'Invalid credentials',
          email: 'unknown'
        }),
        req: mockReq
      });
    });

    it('should not log when status is not 401', () => {
      logFailedAuth(mockReq as Request, mockRes as Response, mockNext);

      mockRes.status(200);
      mockRes.json({ success: true });

      expect(LoggingService.logAction).not.toHaveBeenCalled();
    });
  });

  describe('logSuspiciousActivity', () => {
    it('should log suspicious activity with SQL injection patterns', () => {
      mockReq.body = { query: "SELECT * FROM users WHERE id = 1 UNION SELECT password FROM admin" };

      logSuspiciousActivity(mockReq as Request, mockRes as Response, mockNext);

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'security_suspicious_activity',
        details: expect.objectContaining({
          type: 'potential_attack'
        }),
        req: mockReq
      });
    });

    it('should log suspicious activity with XSS patterns', () => {
      mockReq.body = { comment: "<script>alert('xss')</script>" };

      logSuspiciousActivity(mockReq as Request, mockRes as Response, mockNext);

      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'security_suspicious_activity',
        details: expect.objectContaining({
          type: 'potential_attack'
        }),
        req: mockReq
      });
    });

    it('should not log normal activity', () => {
      mockReq.body = { name: 'John Doe', email: 'john@example.com' };

      logSuspiciousActivity(mockReq as Request, mockRes as Response, mockNext);

      expect(LoggingService.logAction).not.toHaveBeenCalled();
    });
  });

  describe('validateApiKey', () => {
    beforeEach(() => {
      process.env.VALID_API_KEYS = 'key1,key2,key3';
    });

    afterEach(() => {
      delete process.env.VALID_API_KEYS;
    });

    it('should allow request with valid API key', () => {
      mockReq.get = vi.fn((header: string) => {
        if (header === 'X-API-Key') return 'key1';
        return undefined;
      });

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should reject request with invalid API key', () => {
      mockReq.get = vi.fn((header: string) => {
        if (header === 'X-API-Key') return 'invalid-key';
        return undefined;
      });

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid API key' });
      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'security_invalid_api_key',
        details: expect.objectContaining({
          providedKey: 'present'
        }),
        req: mockReq
      });
    });

    it('should reject request without API key when keys are configured', () => {
      mockReq.get = vi.fn(() => undefined);

      validateApiKey(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'security_invalid_api_key',
        details: expect.objectContaining({
          providedKey: 'missing'
        }),
        req: mockReq
      });
    });
  });

  describe('enforceHttps', () => {
    it('should allow HTTP in development', () => {
      process.env.NODE_ENV = 'test';

      enforceHttps(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should enforce HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      mockReq.get = vi.fn(() => 'http');

      enforceHttps(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'HTTPS required' });
      expect(LoggingService.logAction).toHaveBeenCalledWith({
        action: 'security_http_request_in_production',
        details: expect.any(Object),
        req: mockReq
      });
    });

    it('should allow HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      mockReq.get = vi.fn(() => 'https');

      enforceHttps(mockReq as Request, mockRes as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('addSecurityHeaders', () => {
    it('should add security headers to response', () => {
      addSecurityHeaders(mockReq as Request, mockRes as Response, mockNext);

      expect(mockRes.set).toHaveBeenCalledWith({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'Permissions-Policy': 'geolocation=(), microphone=(), camera=()'
      });
      expect(mockNext).toHaveBeenCalled();
    });
  });
});