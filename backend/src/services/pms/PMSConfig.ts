/**
 * PMS Configuration and Utilities
 * 
 * Provides configuration, validation, and helper functions for PMS integration.
 * 
 * Features:
 * 1. PMS provider configuration (required fields, endpoints)
 * 2. Credential validation
 * 3. Environment variable helpers
 * 4. Error code mapping
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Phase 6
 */

import { PMSProvider, PMSCredentials } from './PMSAdapter';

/**
 * Configuration for each PMS provider
 */
export interface PMSProviderConfig {
  provider: PMSProvider;
  name: string;
  requiredFields: string[];
  optionalFields?: string[];
  sandboxUrl?: string;
  productionUrl?: string;
  documentation?: string;
}

/**
 * PMS provider configurations
 */
export const PMS_CONFIGS: Record<PMSProvider, PMSProviderConfig> = {
  mews: {
    provider: 'mews',
    name: 'Mews',
    requiredFields: ['clientToken', 'accessToken', 'serviceId'],
    optionalFields: ['environment', 'propertyId'],
    sandboxUrl: 'https://api.mews-demo.com',
    productionUrl: 'https://api.mews.com',
    documentation: 'https://mews-systems.gitbook.io/connector-api/',
  },
  cloudbeds: {
    provider: 'cloudbeds',
    name: 'Cloudbeds',
    requiredFields: ['propertyId', 'clientId', 'clientSecret'],
    productionUrl: 'https://api.cloudbeds.com',
    documentation: 'https://hotels.cloudbeds.com/api/docs/',
  },
  opera: {
    provider: 'opera',
    name: 'Oracle Opera',
    requiredFields: ['hotelId', 'username', 'password', 'endpoint'],
    documentation: 'https://docs.oracle.com/en/industries/hospitality/opera-cloud-services/',
  },
  resnexus: {
    provider: 'resnexus',
    name: 'RESNexus',
    requiredFields: ['apiKey', 'accountId'],
    productionUrl: 'https://api.resnexus.com',
    documentation: 'https://www.resnexus.com/api',
  },
  none: {
    provider: 'none',
    name: 'No PMS Integration',
    requiredFields: [],
    documentation: 'No external PMS configured',
  },
  other: {
    provider: 'other',
    name: 'Custom PMS',
    requiredFields: ['apiUrl', 'apiKey'],
    documentation: 'Contact your PMS provider',
  },
};

/**
 * PMS Configuration Utility Class
 */
export class PMSConfig {
  /**
   * Validate PMS credentials for a given provider
   * 
   * @param provider - PMS provider
   * @param credentials - Credentials object
   * @returns Validation result with errors
   */
  static validate(
    provider: PMSProvider,
    credentials: Partial<PMSCredentials>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const config = PMS_CONFIGS[provider];

    if (!config) {
      return { valid: false, errors: [`Unknown PMS provider: ${provider}`] };
    }

    // Check required fields
    for (const field of config.requiredFields) {
      const value = (credentials as any)[field];
      if (!value || (typeof value === 'string' && value.trim() === '')) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate specific formats
    if (provider === 'mews') {
      if (credentials.environment && !['sandbox', 'production'].includes(credentials.environment)) {
        errors.push('Mews environment must be "sandbox" or "production"');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get required fields for a PMS provider
   * 
   * @param provider - PMS provider
   * @returns Array of required field names
   */
  static getRequiredFields(provider: PMSProvider): string[] {
    return PMS_CONFIGS[provider]?.requiredFields || [];
  }

  /**
   * Get optional fields for a PMS provider
   * 
   * @param provider - PMS provider
   * @returns Array of optional field names
   */
  static getOptionalFields(provider: PMSProvider): string[] {
    return PMS_CONFIGS[provider]?.optionalFields || [];
  }

  /**
   * Get provider configuration
   * 
   * @param provider - PMS provider
   * @returns Provider config object
   */
  static getProviderConfig(provider: PMSProvider): PMSProviderConfig {
    return PMS_CONFIGS[provider];
  }

  /**
   * Get list of all supported providers
   * 
   * @returns Array of provider names
   */
  static getSupportedProviders(): PMSProvider[] {
    return Object.keys(PMS_CONFIGS) as PMSProvider[];
  }

  /**
   * Check if a provider is supported
   * 
   * @param provider - Provider to check
   * @returns True if supported
   */
  static isSupported(provider: string): boolean {
    return provider in PMS_CONFIGS;
  }

  /**
   * Get environment-based URL for provider
   * 
   * @param provider - PMS provider
   * @param environment - Environment ('sandbox' | 'production')
   * @returns Base URL for API
   */
  static getBaseUrl(provider: PMSProvider, environment?: string): string | undefined {
    const config = PMS_CONFIGS[provider];

    if (!config) {
      return undefined;
    }

    if (environment === 'sandbox' && config.sandboxUrl) {
      return config.sandboxUrl;
    }

    return config.productionUrl;
  }

  /**
   * Sanitize credentials for logging (hide sensitive data)
   * 
   * @param credentials - Credentials object
   * @returns Sanitized credentials safe for logging
   */
  static sanitizeForLogging(credentials: PMSCredentials): any {
    const sanitized: any = { ...credentials };

    // Hide sensitive fields
    const sensitiveFields = [
      'accessToken',
      'clientToken',
      'clientSecret',
      'password',
      'apiKey',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        const value = sanitized[field];
        sanitized[field] = value.substring(0, 4) + '***' + value.substring(value.length - 4);
      }
    }

    return sanitized;
  }
}

/**
 * PMS Error Code Mapping
 * Maps common PMS error codes to user-friendly messages
 */
export const PMS_ERROR_MESSAGES: Record<string, string> = {
  // Mews
  MEWS_AUTH_FAILED: 'Mews authentication failed. Please check your credentials.',
  MEWS_SERVICE_NOT_FOUND: 'Mews service not found. Check your Service ID.',
  MEWS_RESOURCE_UNAVAILABLE: 'Room category is not available for the selected dates.',
  MEWS_CUSTOMER_EXISTS: 'Customer already exists in Mews.',
  MEWS_RESERVATION_CONFLICT: 'Reservation conflicts with an existing booking.',

  // Cloudbeds
  CLOUDBEDS_AUTH_FAILED: 'Cloudbeds authentication failed. Please check your credentials.',
  CLOUDBEDS_PROPERTY_NOT_FOUND: 'Property not found in Cloudbeds.',
  CLOUDBEDS_ROOM_UNAVAILABLE: 'Room is not available for the selected dates.',

  // Generic
  PMS_CONNECTION_TIMEOUT: 'Connection to PMS timed out. Please try again.',
  PMS_RATE_LIMIT: 'Too many requests to PMS. Please wait and try again.',
  PMS_UNKNOWN_ERROR: 'An unknown error occurred with the PMS integration.',
  PMS_INVALID_DATE: 'Invalid check-in or check-out date.',
  PMS_INVALID_GUEST: 'Invalid guest information provided.',
};

/**
 * Get user-friendly error message for error code
 * 
 * @param errorCode - Error code
 * @returns User-friendly message
 */
export function getPMSErrorMessage(errorCode: string): string {
  return PMS_ERROR_MESSAGES[errorCode] || PMS_ERROR_MESSAGES.PMS_UNKNOWN_ERROR;
}

/**
 * Environment variable helper for PMS configuration
 */
export class PMSEnvironment {
  /**
   * Get Mews configuration from environment variables
   */
  static getMewsConfig(): PMSCredentials | null {
    const clientToken = process.env.MEWS_CLIENT_TOKEN;
    const accessToken = process.env.MEWS_ACCESS_TOKEN;
    const serviceId = process.env.MEWS_SERVICE_ID;
    const environment = (process.env.MEWS_ENVIRONMENT || 'sandbox') as 'sandbox' | 'production';
    const propertyId = process.env.MEWS_PROPERTY_ID;

    if (!clientToken || !accessToken || !serviceId) {
      return null;
    }

    return {
      provider: 'mews',
      propertyId: propertyId || '',
      clientToken,
      accessToken,
      serviceId,
      environment,
    };
  }

  /**
   * Get Cloudbeds configuration from environment variables
   */
  static getCloudbedsConfig(): PMSCredentials | null {
    const propertyId = process.env.CLOUDBEDS_PROPERTY_ID;
    const clientId = process.env.CLOUDBEDS_CLIENT_ID;
    const clientSecret = process.env.CLOUDBEDS_CLIENT_SECRET;

    if (!propertyId || !clientId || !clientSecret) {
      return null;
    }

    return {
      provider: 'cloudbeds',
      propertyId,
      clientId,
      clientSecret,
    };
  }

  /**
   * Check if PMS integration is enabled for any provider
   */
  static isEnabled(): boolean {
    return !!(this.getMewsConfig() || this.getCloudbedsConfig());
  }
}

export default PMSConfig;
