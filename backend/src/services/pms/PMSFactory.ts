import Property from '../../models/Property';
import { decryptPMSCredentials } from '../../utils/pmsEncryption';
import MewsAdapter from '../mews/mewsAdapter';
import MockPMSAdapter from './MockPMSAdapter';

// Base interface for all PMS adapters
export interface IPMSAdapter {
  setPropertyId(propertyId: string): void;
  getPropertyId(): string | undefined;
  testConnection(): Promise<{ success: boolean; error?: string; propertyInfo?: any }>;
  getAvailability(params: any): Promise<any>;
  getBookings(params: any): Promise<any>;
  createBooking(params: any): Promise<any>;
  updateBooking(bookingId: string, params: any): Promise<any>;
  cancelBooking(bookingId: string): Promise<any>;
  getPropertyInfo(propertyId?: string): Promise<any>;
}

/**
 * PMSFactory - Creates PMS adapters configured for specific properties
 */
export class PMSFactory {
  /**
   * Get a PMS adapter for a specific property
   * @param propertyId - ID of the property in our database
   * @returns Configured PMS adapter for that property
   */
  static async getAdapter(propertyId: number): Promise<IPMSAdapter> {
    // Fetch property with PMS configuration
    const property = await Property.findByPk(propertyId);

    if (!property) {
      throw new Error(`Property ${propertyId} not found`);
    }

    // If no PMS configured, return mock adapter
    if (!property.pms_provider || property.pms_provider === 'none') {
      const mockAdapter = new MockPMSAdapter();
      mockAdapter.setPropertyId(String(propertyId));
      return mockAdapter;
    }

    // Decrypt credentials
    let credentials: any = {};
    if (property.pms_credentials) {
      try {
        credentials = decryptPMSCredentials(property.pms_credentials);
      } catch (error) {
        console.error(`Failed to decrypt PMS credentials for property ${propertyId}:`, error);
        throw new Error('Invalid PMS credentials configuration');
      }
    }

    // Create adapter based on provider
    const adapter = this.createAdapter(property.pms_provider, credentials);

    // Set the specific property ID in the PMS system
    if (property.pms_property_id) {
      adapter.setPropertyId(property.pms_property_id);
    }

    return adapter;
  }

  /**
   * Create a PMS adapter without database lookup (for validation/testing)
   * @param provider - PMS provider type
   * @param credentials - PMS credentials
   * @returns PMS adapter instance
   */
  static createAdapter(provider: string, credentials: any): IPMSAdapter {
    switch (provider) {
      case 'mews':
        return new MewsAdapter(credentials);
      
      case 'cloudbeds':
        // return new CloudbedsAdapter(credentials);
        throw new Error('Cloudbeds adapter not yet implemented');
      
      case 'resnexus':
        // return new ResNexusAdapter(credentials);
        throw new Error('ResNexus adapter not yet implemented');
      
      case 'opera':
        // return new OperaAdapter(credentials);
        throw new Error('Opera adapter not yet implemented');
      
      case 'none':
      default:
        return new MockPMSAdapter();
    }
  }

  /**
   * Test PMS connection without saving credentials
   * @param provider - PMS provider type
   * @param credentials - PMS credentials to test
   * @param propertyId - Optional property ID in PMS system
   */
  static async testConnection(
    provider: string,
    credentials: any,
    propertyId?: string
  ): Promise<{ success: boolean; error?: string; propertyInfo?: any }> {
    try {
      const adapter = this.createAdapter(provider, credentials);
      
      if (propertyId) {
        adapter.setPropertyId(propertyId);
      }

      return await adapter.testConnection();
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Connection test failed'
      };
    }
  }
}

export default PMSFactory;
