import TimeshareProperty from '../../models/v2/TimeshareProperty';
import { decryptPMSCredentials } from '../../utils/pmsEncryption';
import { PMSAdapter, PMSProvider, PMSCredentials, PMSBookingStatus } from './PMSAdapter';
import { MewsAdapter } from './MewsAdapter';
import { MockPMSAdapter } from './MockPMSService';

/**
 * PMSFactory - Creates PMS adapters configured for specific properties
 * Updated for V2 architecture with new PMSAdapter interface
 */
export class PMSFactory {
  /**
   * Get a PMS adapter for a specific V2 property
   * @param propertyId - ID of the TimeshareProperty in V2 database
   * @returns Configured PMS adapter for that property
   */
  static async getAdapter(propertyId: number): Promise<PMSAdapter> {
    // Fetch V2 property with PMS configuration
    const property = await TimeshareProperty.findByPk(propertyId);

    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    return this.createFromProperty(property);
  }

  /**
   * Create adapter directly from TimeshareProperty instance
   * @param property - TimeshareProperty model instance
   * @returns Configured PMS adapter
   */
  static createFromProperty(property: any): PMSAdapter {
    // If no PMS configured, return mock adapter
    if (!property.pms_provider || property.pms_provider === 'none') {
      return new MockPMSAdapter({
        provider: 'other',
        propertyId: String(property.id)
      });
    }

    // Decrypt credentials
    let credentials: PMSCredentials;
    if (property.pms_credentials) {
      try {
        const decrypted = decryptPMSCredentials(property.pms_credentials);
        credentials = {
          provider: property.pms_provider as PMSProvider,
          propertyId: property.pms_property_id || String(property.id),
          ...decrypted
        };
      } catch (error) {
        console.error(`Failed to decrypt PMS credentials for property ${property.id}:`, error);
        throw new Error('Invalid PMS credentials configuration');
      }
    } else {
      throw new Error(`Property ${property.id} has PMS provider but no credentials`);
    }

    // Create adapter based on provider
    return this.create(property.pms_provider as PMSProvider, credentials);
  }

  /**
   * Create a PMS adapter by provider type
   * @param provider - PMS provider type
   * @param credentials - PMS credentials
   * @returns PMS adapter instance
   */
  static create(provider: PMSProvider, credentials: PMSCredentials): PMSAdapter {
    switch (provider) {
      case 'mews':
        return new MewsAdapter(credentials as any);
      
      case 'cloudbeds':
        console.warn('[PMSFactory] Cloudbeds not implemented, using mock');
        return new MockPMSAdapter(credentials);
      
      case 'opera':
        console.warn('[PMSFactory] Opera not implemented, using mock');
        return new MockPMSAdapter(credentials);
      
      case 'other':
      default:
        return new MockPMSAdapter(credentials);
    }
  }

  /**
   * Test PMS connection without saving credentials
   * @param provider - PMS provider type
   * @param credentials - PMS credentials to test
   */
  static async testConnection(
    provider: PMSProvider,
    credentials: PMSCredentials
  ): Promise<boolean> {
    try {
      const adapter = this.create(provider, credentials);
      return await adapter.testConnection();
    } catch (error: any) {
      console.error('[PMSFactory] Connection test failed:', error);
      return false;
    }
  }
}

export default PMSFactory;
