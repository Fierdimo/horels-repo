/**
 * PMSFactory Unit Tests
 * 
 * Tests the factory pattern for creating PMS adapters.
 * Verifies adapter creation, database integration, and connection testing.
 */

import { describe, it, expect, afterEach, vi, beforeEach } from 'vitest';
import { PMSFactory } from '../../../src/services/pms/PMSFactory';
import { MewsAdapter } from '../../../src/services/pms/MewsAdapter';
import { PMSAdapter } from '../../../src/services/pms/PMSAdapter';
import TimeshareProperty from '../../../src/models/v2/TimeshareProperty';
import * as pmsEncryption from '../../../src/utils/pmsEncryption';

// Mock modules
vi.mock('../../../src/models/v2/TimeshareProperty');
vi.mock('../../../src/utils/pmsEncryption', () => ({
  decryptPMSCredentials: vi.fn(() => ({
    propertyId: 'test-property',
    clientToken: 'client-token',
    accessToken: 'access-token',
    serviceId: 'service-id',
    environment: 'sandbox',
  })),
}));

describe('PMSFactory', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  describe('create', () => {
    it('should create MewsAdapter for mews provider', () => {
      const credentials = {
        provider: 'mews' as const,
        propertyId: 'test-property',
        clientToken: 'client-token',
        accessToken: 'access-token',
        serviceId: 'service-id',
        environment: 'sandbox' as const,
      };

      const adapter = PMSFactory.create(credentials.provider, credentials);

      expect(adapter).toBeInstanceOf(MewsAdapter);
      expect(adapter.getProvider()).toBe('mews');
    });

    it('should create MockPMSAdapter for cloudbeds', () => {
      const credentials = {
        provider: 'cloudbeds' as const,
        propertyId: 'test-property',
        apiKey: 'api-key',
      };

      const adapter = PMSFactory.create(credentials.provider, credentials);

      expect(adapter.getProvider()).toBe('other'); // Mock returns 'other'
    });

    it('should create MockPMSAdapter for opera', () => {
      const credentials = {
        provider: 'opera' as const,
        propertyId: 'test-property',
        apiKey: 'api-key',
      };

      const adapter = PMSFactory.create(credentials.provider, credentials);

      expect(adapter.getProvider()).toBe('other');
    });

    it('should create MockPMSAdapter for other provider', () => {
      const credentials = {
        provider: 'other' as const,
        propertyId: 'test-property',
        apiKey: 'api-key',
      };

      const adapter = PMSFactory.create(credentials.provider, credentials);

      expect(adapter.getProvider()).toBe('other');
    });
  });

  describe('createFromProperty', () => {
    it('should create adapter from property with PMS config', () => {
      const mockProperty = {
        id: 123,
        name: 'Test Property',
        pms_provider: 'mews',
        pms_credentials: 'encrypted-credentials',
      };

      const adapter = PMSFactory.createFromProperty(mockProperty as any);

      expect(adapter).toBeInstanceOf(MewsAdapter);
      expect(adapter.getProvider()).toBe('mews');
    });

    it('should create MockAdapter if no PMS provider', () => {
      const mockProperty = {
        id: 123,
        name: 'Test Property',
        pms_provider: null,
        pms_credentials_encrypted: null,
      };

      const adapter = PMSFactory.createFromProperty(mockProperty as any);

      expect(adapter.getProvider()).toBe('other'); // Mock
    });

    it('should throw error if credentials missing', () => {
      const mockProperty = {
        id: 123,
        name: 'Test Property',
        pms_provider: 'mews',
        pms_credentials_encrypted: null, // Missing credentials
      };

      expect(() => {
        PMSFactory.createFromProperty(mockProperty as any);
      }).toThrow('Property 123 has PMS provider but no credentials');
    });

    it('should throw error if credentials decryption fails', () => {
      const mockProperty = {
        id: 123,
        name: 'Test Property',
        pms_provider: 'mews',
        pms_credentials: 'encrypted-credentials',
      };

      // Mock decryption failure for this test only
      vi.mocked(pmsEncryption.decryptPMSCredentials).mockImplementationOnce(() => {
        throw new Error('Decryption failed');
      });

      expect(() => {
        PMSFactory.createFromProperty(mockProperty as any);
      }).toThrow('Invalid PMS credentials configuration');
    });
  });

  describe('getAdapter', () => {
    it('should load property and create adapter', async () => {
      const mockProperty = {
        id: 123,
        name: 'Test Property',
        pms_provider: 'mews',
        pms_credentials: 'encrypted-credentials',
      };

      vi.mocked(TimeshareProperty.findByPk).mockResolvedValue(mockProperty as any);

      const adapter = await PMSFactory.getAdapter(123);

      expect(TimeshareProperty.findByPk).toHaveBeenCalledWith(123);
      expect(adapter).toBeInstanceOf(MewsAdapter);
    });

    it('should throw error if property not found', async () => {
      vi.mocked(TimeshareProperty.findByPk).mockResolvedValue(null);

      await expect(PMSFactory.getAdapter(999)).rejects.toThrow('Property 999 not found');
    });
  });

  describe('testConnection', () => {
    it('should test connection successfully', async () => {
      const credentials = {
        provider: 'mews' as const,
        propertyId: 'test-property',
        clientToken: 'client-token',
        accessToken: 'access-token',
        serviceId: 'service-id',
        environment: 'sandbox' as const,
      };

      const mockTestConnection = vi.fn().mockResolvedValue(true);
      vi.spyOn(PMSFactory, 'create').mockReturnValue({
        getProvider: () => 'mews',
        testConnection: mockTestConnection,
      } as any);

      const result = await PMSFactory.testConnection(credentials.provider, credentials);

      expect(result).toBe(true);
      expect(mockTestConnection).toHaveBeenCalled();
    });

    it('should return false on connection failure', async () => {
      const credentials = {
        provider: 'mews' as const,
        propertyId: 'test-property',
        clientToken: 'client-token',
        accessToken: 'access-token',
        serviceId: 'service-id',
        environment: 'sandbox' as const,
      };

      const mockTestConnection = vi.fn().mockResolvedValue(false);
      vi.spyOn(PMSFactory, 'create').mockReturnValue({
        getProvider: () => 'mews',
        testConnection: mockTestConnection,
      } as any);

      const result = await PMSFactory.testConnection(credentials.provider, credentials);

      expect(result).toBe(false);
    });

    it('should return false on adapter creation error', async () => {
      const credentials = {
        provider: 'mews' as const,
        propertyId: 'test-property',
      };

      vi.spyOn(PMSFactory, 'create').mockImplementation(() => {
        throw new Error('Invalid credentials');
      });

      const result = await PMSFactory.testConnection(credentials.provider, credentials);

      expect(result).toBe(false);
    });
  });

  describe('MockPMSAdapter', () => {
    let mockAdapter: PMSAdapter;

    beforeEach(() => {
      const mockCredentials = {
        provider: 'other' as const,
        propertyId: 'test-property',
        apiKey: 'test-key',
      };
      mockAdapter = PMSFactory.create(mockCredentials.provider, mockCredentials);
    });

    it('should create mock booking successfully', async () => {
      const result = await mockAdapter.createBooking({
        checkIn: new Date('2024-01-15'),
        checkOut: new Date('2024-01-20'),
        guest: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
        },
        numberOfGuests: 2,
        roomCategory: 'Deluxe Room',
        internalBookingId: 123,
        internalConfirmationCode: 'BK-123',
      });

      expect(result.success).toBe(true);
      expect(result.pmsBookingId).toContain('MOCK-');
      expect(result.status).toBe('CONFIRMED');
    });

    it('should cancel mock booking successfully', async () => {
      const result = await mockAdapter.cancelBooking({
        pmsBookingId: 'MOCK-123',
        reason: 'Test cancellation',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('CANCELLED');
    });

    it('should get mock booking status', async () => {
      const result = await mockAdapter.getBookingStatus('MOCK-123');

      expect(result.status).toBe('CONFIRMED');
      expect(result.pmsBookingId).toBe('MOCK-123');
    });

    it('should get mock availability', async () => {
      const result = await mockAdapter.getAvailability({
        checkIn: new Date('2024-01-15'),
        checkOut: new Date('2024-01-20'),
      });

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1); // Mock returns 1 room type
      expect(result[0].roomCategory).toBeDefined();
      expect(result[0].availableRooms).toBeGreaterThan(0);
    });
  });
});
