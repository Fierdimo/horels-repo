/**
 * PMSConfig Unit Tests
 * 
 * Tests PMS configuration validation and utilities.
 */

import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import {
  PMSConfig,
  PMSEnvironment,
  PMS_CONFIGS,
  getPMSErrorMessage,
} from '../../../src/services/pms/PMSConfig';
import { PMSProvider, PMSCredentials } from '../../../src/services/pms/PMSAdapter';

describe('PMSConfig', () => {
  describe('validate', () => {
    it('should validate valid Mews credentials', () => {
      const credentials: Partial<PMSCredentials> = {
        clientToken: 'test-token',
        accessToken: 'test-access',
        serviceId: 'test-service',
        environment: 'sandbox',
      };

      const result = PMSConfig.validate('mews', credentials);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject Mews credentials missing clientToken', () => {
      const credentials: Partial<PMSCredentials> = {
        accessToken: 'test-access',
        serviceId: 'test-service',
      };

      const result = PMSConfig.validate('mews', credentials);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: clientToken');
    });

    it('should reject Mews credentials missing accessToken', () => {
      const credentials: Partial<PMSCredentials> = {
        clientToken: 'test-token',
        serviceId: 'test-service',
      };

      const result = PMSConfig.validate('mews', credentials);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: accessToken');
    });

    it('should reject Mews credentials missing serviceId', () => {
      const credentials: Partial<PMSCredentials> = {
        clientToken: 'test-token',
        accessToken: 'test-access',
      };

      const result = PMSConfig.validate('mews', credentials);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: serviceId');
    });

    it('should reject invalid Mews environment', () => {
      const credentials: any = {
        clientToken: 'test-token',
        accessToken: 'test-access',
        serviceId: 'test-service',
        environment: 'invalid',
      };

      const result = PMSConfig.validate('mews', credentials);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Mews environment must be "sandbox" or "production"');
    });

    it('should reject empty string values', () => {
      const credentials: Partial<PMSCredentials> = {
        clientToken: '',
        accessToken: 'test-access',
        serviceId: 'test-service',
      };

      const result = PMSConfig.validate('mews', credentials);

      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Missing required field: clientToken');
    });

    it('should validate Cloudbeds credentials', () => {
      const credentials: Partial<PMSCredentials> = {
        propertyId: 'test-property',
        clientId: 'test-client',
        clientSecret: 'test-secret',
      };

      const result = PMSConfig.validate('cloudbeds', credentials);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject unknown provider', () => {
      const result = PMSConfig.validate('unknown' as PMSProvider, {});

      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Unknown PMS provider');
    });
  });

  describe('getRequiredFields', () => {
    it('should return required fields for Mews', () => {
      const fields = PMSConfig.getRequiredFields('mews');

      expect(fields).toEqual(['clientToken', 'accessToken', 'serviceId']);
    });

    it('should return required fields for Cloudbeds', () => {
      const fields = PMSConfig.getRequiredFields('cloudbeds');

      expect(fields).toEqual(['propertyId', 'clientId', 'clientSecret']);
    });

    it('should return required fields for Opera', () => {
      const fields = PMSConfig.getRequiredFields('opera');

      expect(fields).toEqual(['hotelId', 'username', 'password', 'endpoint']);
    });
  });

  describe('getOptionalFields', () => {
    it('should return optional fields for Mews', () => {
      const fields = PMSConfig.getOptionalFields('mews');

      expect(fields).toEqual(['environment', 'propertyId']);
    });

    it('should return empty array if no optional fields', () => {
      const fields = PMSConfig.getOptionalFields('cloudbeds');

      expect(fields).toEqual([]);
    });
  });

  describe('getProviderConfig', () => {
    it('should return Mews configuration', () => {
      const config = PMSConfig.getProviderConfig('mews');

      expect(config.provider).toBe('mews');
      expect(config.name).toBe('Mews');
      expect(config.sandboxUrl).toBe('https://api.mews-demo.com');
      expect(config.productionUrl).toBe('https://api.mews.com');
    });

    it('should return Cloudbeds configuration', () => {
      const config = PMSConfig.getProviderConfig('cloudbeds');

      expect(config.provider).toBe('cloudbeds');
      expect(config.name).toBe('Cloudbeds');
      expect(config.productionUrl).toBe('https://api.cloudbeds.com');
    });
  });

  describe('getSupportedProviders', () => {
    it('should return all supported providers', () => {
      const providers = PMSConfig.getSupportedProviders();

      expect(providers).toContain('mews');
      expect(providers).toContain('cloudbeds');
      expect(providers).toContain('opera');
      expect(providers).toContain('other');
      expect(providers.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe('isSupported', () => {
    it('should return true for supported providers', () => {
      expect(PMSConfig.isSupported('mews')).toBe(true);
      expect(PMSConfig.isSupported('cloudbeds')).toBe(true);
      expect(PMSConfig.isSupported('opera')).toBe(true);
    });

    it('should return false for unsupported providers', () => {
      expect(PMSConfig.isSupported('unknown')).toBe(false);
      expect(PMSConfig.isSupported('invalid')).toBe(false);
    });
  });

  describe('getBaseUrl', () => {
    it('should return sandbox URL for Mews', () => {
      const url = PMSConfig.getBaseUrl('mews', 'sandbox');

      expect(url).toBe('https://api.mews-demo.com');
    });

    it('should return production URL for Mews', () => {
      const url = PMSConfig.getBaseUrl('mews', 'production');

      expect(url).toBe('https://api.mews.com');
    });

    it('should return production URL if environment not specified', () => {
      const url = PMSConfig.getBaseUrl('mews');

      expect(url).toBe('https://api.mews.com');
    });

    it('should return production URL for Cloudbeds', () => {
      const url = PMSConfig.getBaseUrl('cloudbeds');

      expect(url).toBe('https://api.cloudbeds.com');
    });

    it('should return undefined for unsupported provider', () => {
      const url = PMSConfig.getBaseUrl('unknown' as PMSProvider);

      expect(url).toBeUndefined();
    });
  });

  describe('sanitizeForLogging', () => {
    it('should mask sensitive fields', () => {
      const credentials: PMSCredentials = {
        provider: 'mews',
        propertyId: 'test-property',
        clientToken: '1234567890abcdef',
        accessToken: 'abcdefghij1234567890',
        serviceId: 'service-id-123',
      };

      const sanitized = PMSConfig.sanitizeForLogging(credentials);

      expect(sanitized.provider).toBe('mews');
      expect(sanitized.propertyId).toBe('test-property');
      expect(sanitized.serviceId).toBe('service-id-123');
      expect(sanitized.clientToken).toMatch(/^1234\*\*\*cdef$/);
      expect(sanitized.accessToken).toMatch(/^abcd\*\*\*7890$/);
    });

    it('should handle short tokens', () => {
      const credentials: PMSCredentials = {
        provider: 'mews',
        propertyId: 'test',
        clientToken: 'short',
        accessToken: 'tiny',
      };

      const sanitized = PMSConfig.sanitizeForLogging(credentials);

      expect(sanitized.clientToken).toContain('***');
      expect(sanitized.accessToken).toContain('***');
    });

    it('should not mask non-sensitive fields', () => {
      const credentials: PMSCredentials = {
        provider: 'mews',
        propertyId: 'test-property',
        serviceId: 'test-service',
      };

      const sanitized = PMSConfig.sanitizeForLogging(credentials);

      expect(sanitized.propertyId).toBe('test-property');
      expect(sanitized.serviceId).toBe('test-service');
    });
  });
});

describe('PMSEnvironment', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getMewsConfig', () => {
    it('should load Mews config from environment', () => {
      process.env.MEWS_CLIENT_TOKEN = 'test-token';
      process.env.MEWS_ACCESS_TOKEN = 'test-access';
      process.env.MEWS_SERVICE_ID = 'test-service';
      process.env.MEWS_ENVIRONMENT = 'production';
      process.env.MEWS_PROPERTY_ID = 'test-property';

      const config = PMSEnvironment.getMewsConfig();

      expect(config).not.toBeNull();
      expect(config?.provider).toBe('mews');
      expect(config?.clientToken).toBe('test-token');
      expect(config?.accessToken).toBe('test-access');
      expect(config?.serviceId).toBe('test-service');
      expect(config?.environment).toBe('production');
      expect(config?.propertyId).toBe('test-property');
    });

    it('should default to sandbox environment', () => {
      process.env.MEWS_CLIENT_TOKEN = 'test-token';
      process.env.MEWS_ACCESS_TOKEN = 'test-access';
      process.env.MEWS_SERVICE_ID = 'test-service';
      delete process.env.MEWS_ENVIRONMENT;

      const config = PMSEnvironment.getMewsConfig();

      expect(config?.environment).toBe('sandbox');
    });

    it('should return null if credentials missing', () => {
      delete process.env.MEWS_CLIENT_TOKEN;
      delete process.env.MEWS_ACCESS_TOKEN;

      const config = PMSEnvironment.getMewsConfig();

      expect(config).toBeNull();
    });
  });

  describe('getCloudbedsConfig', () => {
    it('should load Cloudbeds config from environment', () => {
      process.env.CLOUDBEDS_PROPERTY_ID = 'test-property';
      process.env.CLOUDBEDS_CLIENT_ID = 'test-client';
      process.env.CLOUDBEDS_CLIENT_SECRET = 'test-secret';

      const config = PMSEnvironment.getCloudbedsConfig();

      expect(config).not.toBeNull();
      expect(config?.provider).toBe('cloudbeds');
      expect(config?.propertyId).toBe('test-property');
      expect(config?.clientId).toBe('test-client');
      expect(config?.clientSecret).toBe('test-secret');
    });

    it('should return null if credentials missing', () => {
      delete process.env.CLOUDBEDS_PROPERTY_ID;

      const config = PMSEnvironment.getCloudbedsConfig();

      expect(config).toBeNull();
    });
  });

  describe('isEnabled', () => {
    it('should return true if Mews configured', () => {
      process.env.MEWS_CLIENT_TOKEN = 'test-token';
      process.env.MEWS_ACCESS_TOKEN = 'test-access';
      process.env.MEWS_SERVICE_ID = 'test-service';

      const enabled = PMSEnvironment.isEnabled();

      expect(enabled).toBe(true);
    });

    it('should return true if Cloudbeds configured', () => {
      delete process.env.MEWS_CLIENT_TOKEN;
      process.env.CLOUDBEDS_PROPERTY_ID = 'test-property';
      process.env.CLOUDBEDS_CLIENT_ID = 'test-client';
      process.env.CLOUDBEDS_CLIENT_SECRET = 'test-secret';

      const enabled = PMSEnvironment.isEnabled();

      expect(enabled).toBe(true);
    });

    it('should return false if no PMS configured', () => {
      delete process.env.MEWS_CLIENT_TOKEN;
      delete process.env.CLOUDBEDS_PROPERTY_ID;

      const enabled = PMSEnvironment.isEnabled();

      expect(enabled).toBe(false);
    });
  });
});

describe('getPMSErrorMessage', () => {
  it('should return message for known error code', () => {
    const message = getPMSErrorMessage('MEWS_AUTH_FAILED');

    expect(message).toBe('Mews authentication failed. Please check your credentials.');
  });

  it('should return generic message for unknown error code', () => {
    const message = getPMSErrorMessage('UNKNOWN_ERROR_CODE');

    expect(message).toBe('An unknown error occurred with the PMS integration.');
  });

  it('should handle PMS connection errors', () => {
    expect(getPMSErrorMessage('PMS_CONNECTION_TIMEOUT')).toContain('Connection to PMS timed out');
    expect(getPMSErrorMessage('PMS_RATE_LIMIT')).toContain('Too many requests');
  });
});

describe('PMS_CONFIGS', () => {
  it('should have configuration for all providers', () => {
    expect(PMS_CONFIGS.mews).toBeDefined();
    expect(PMS_CONFIGS.cloudbeds).toBeDefined();
    expect(PMS_CONFIGS.opera).toBeDefined();
    expect(PMS_CONFIGS.other).toBeDefined();
  });

  it('should have consistent structure', () => {
    Object.values(PMS_CONFIGS).forEach((config) => {
      expect(config.provider).toBeDefined();
      expect(config.name).toBeDefined();
      expect(config.requiredFields).toBeInstanceOf(Array);
      expect(config.requiredFields.length).toBeGreaterThan(0);
    });
  });
});
