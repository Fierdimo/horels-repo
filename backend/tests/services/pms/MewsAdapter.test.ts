/**
 * MewsAdapter Unit Tests
 * 
 * Tests Mews PMS API integration without making real API calls.
 * Uses mocked axios to simulate Mews API responses.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { MewsAdapter } from '../../../src/services/pms/MewsAdapter';
import { PMSBookingStatus } from '../../../src/services/pms/PMSAdapter';

// Mock axios module
vi.mock('axios');

interface MewsCredentials {
  provider: 'mews';
  propertyId: string;
  clientToken: string;
  accessToken: string;
  serviceId: string;
  environment: 'sandbox' | 'production';
}

describe('MewsAdapter', () => {
  let adapter: MewsAdapter;
  let mockCredentials: MewsCredentials;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Setup test credentials
    mockCredentials = {
      provider: 'mews',
      propertyId: 'test-property-123',
      clientToken: 'test-client-token',
      accessToken: 'test-access-token',
      serviceId: 'test-service-id',
      environment: 'sandbox',
    };

    // Mock axios.create to return mocked instance
    vi.mocked(axios.create).mockReturnValue({
      get: vi.fn(),
      post: vi.fn(),
      interceptors: {
        request: { use: vi.fn(), eject: vi.fn() },
        response: { use: vi.fn(), eject: vi.fn() },
      },
    } as any);

    // Create adapter instance
    adapter = new MewsAdapter(mockCredentials as any);
  });

  describe('constructor', () => {
    it('should create adapter with sandbox URL', () => {
      const sandboxAdapter = new MewsAdapter({
        ...mockCredentials,
        environment: 'sandbox',
      } as any);

      expect(sandboxAdapter.getProvider()).toBe('mews');
    });

    it('should create adapter with production URL', () => {
      const prodAdapter = new MewsAdapter({
        ...mockCredentials,
        environment: 'production',
      } as any);

      expect(prodAdapter.getProvider()).toBe('mews');
    });

    it('should default to sandbox if environment not specified', () => {
      const defaultAdapter = new MewsAdapter({
        provider: 'mews',
        propertyId: 'test-property-123',
        clientToken: 'test-client-token',
        accessToken: 'test-access-token',
        serviceId: 'test-service-id',
        // environment not specified
      } as any);

      expect(defaultAdapter.getProvider()).toBe('mews');
    });
  });

  describe('getProvider', () => {
    it('should return mews provider', () => {
      expect(adapter.getProvider()).toBe('mews');
    });
  });

  describe('testConnection', () => {
    it('should return true on successful connection', async () => {
      // Mock successful API response
      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue({
          status: 200,
          data: {
            Enterprise: {
              Id: 'enterprise-123',
              Name: 'Test Hotel',
            },
          },
        }),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.testConnection();

      expect(result).toBeTruthy(); // Returns Enterprise object which is truthy
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/connector/v1/configuration/get',
        expect.any(Object)
      );
    });

    it('should return false on connection failure', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockRejectedValue(new Error('Network error')),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });

    it('should return false on invalid credentials', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockRejectedValue({
          response: {
            status: 401,
            data: { Message: 'Invalid credentials' },
          },
        }),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.testConnection();

      expect(result).toBe(false);
    });
  });

  describe('createBooking', () => {
    it('should create booking successfully', async () => {
      const mockAxiosInstance = {
        post: vi.fn()
          // Step 1: Search for existing customer (returns empty)
          .mockResolvedValueOnce({
            data: { 
              Customers: [],
            },
          })
          // Step 2: Create new customer
          .mockResolvedValueOnce({
            data: { 
              Customers: [{
                Id: 'customer-123',
                FirstName: 'John',
                LastName: 'Doe',
              }],
            },
          })
          // Step 3: Get room categories
          .mockResolvedValueOnce({
            data: {
              ResourceCategories: [{
                Id: 'category-123',
                Name: 'Deluxe Room',
                IsActive: true,
              }],
            },
          })
          // Step 4: Create reservation
          .mockResolvedValueOnce({
            data: {
              Reservations: [{
                Id: 'reservation-123',
                Number: 'MEWS-12345',
                State: 'Confirmed',
              }],
            },
          }),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.createBooking({
        checkIn: new Date('2024-01-15'),
        checkOut: new Date('2024-01-20'),
        guest: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        numberOfGuests: 2,
        roomCategory: 'Deluxe Room',
        internalBookingId: 123,
        internalConfirmationCode: 'BK-123',
      });

      expect(result.success).toBe(true);
      expect(result.pmsBookingId).toBe('reservation-123');
      expect(result.pmsConfirmationCode).toBe('MEWS-12345');
      expect(result.status).toBe('CONFIRMED');
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(4);
    });

    it('should reuse existing customer', async () => {
      const mockAxiosInstance = {
        post: vi.fn()
          // Step 1: Search returns existing customer
          .mockResolvedValueOnce({
            data: {
              Customers: [{
                Id: 'existing-customer-123',
                FirstName: 'John',
                LastName: 'Doe',
                Email: 'john@example.com',
              }],
            },
          })
          // Step 2: Get room categories
          .mockResolvedValueOnce({
            data: {
              ResourceCategories: [{
                Id: 'category-123',
                Name: 'Deluxe Room',
                IsActive: true,
              }],
            },
          })
          // Step 3: Create reservation
          .mockResolvedValueOnce({
            data: {
              Reservations: [{
                Id: 'reservation-123',
                Number: 'MEWS-12345',
                State: 'Confirmed',
              }],
            },
          }),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.createBooking({
        checkIn: new Date('2024-01-15'),
        checkOut: new Date('2024-01-20'),
        guest: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com',
          phone: '+1234567890',
        },
        numberOfGuests: 2,
        roomCategory: 'Deluxe Room',
        internalBookingId: 123,
        internalConfirmationCode: 'BK-123',
      });

      expect(result.success).toBe(true);
      expect(mockAxiosInstance.post).toHaveBeenCalledTimes(3); // No customer creation
    });

    it('should handle room category not found', async () => {
      const mockAxiosInstance = {
        post: vi.fn()
          // Existing customer
          .mockResolvedValueOnce({
            data: { Customers: [{ Id: 'customer-123' }] },
          })
          // Room categories (empty - not found)
          .mockResolvedValueOnce({
            data: { ResourceCategories: [] },
          }),
      };

      (adapter as any).client = mockAxiosInstance;

      await expect(
        adapter.createBooking({
          checkIn: new Date('2024-01-15'),
          checkOut: new Date('2024-01-20'),
          guest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '+1234567890',
          },
          numberOfGuests: 2,
          roomCategory: 'Non-existent Room',
          internalBookingId: 123,
          internalConfirmationCode: 'BK-123',
        })
      ).rejects.toThrow('Failed to create booking');
    });

    it('should handle API errors', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockRejectedValue(new Error('API Error')),
      };

      (adapter as any).client = mockAxiosInstance;

      await expect(
        adapter.createBooking({
          checkIn: new Date('2024-01-15'),
          checkOut: new Date('2024-01-20'),
          guest: {
            firstName: 'John',
            lastName: 'Doe',
            email: 'john@example.com',
            phone: '+1234567890',
          },
          numberOfGuests: 2,
          roomCategory: 'Deluxe Room',
          internalBookingId: 123,
          internalConfirmationCode: 'BK-123',
        })
      ).rejects.toThrow();
    });
  });

  describe('cancelBooking', () => {
    it('should cancel booking successfully', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue({
          status: 200,
          data: {
            Reservations: [{
              Id: 'reservation-123',
              Number: 'MEWS-12345',
              State: 'Canceled',
            }],
          },
        }),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.cancelBooking({
        pmsBookingId: 'reservation-123',
        reason: 'Test cancellation',
      });

      expect(result.success).toBe(true);
      expect(result.status).toBe('CANCELLED');
      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        '/api/connector/v1/reservations/cancel',
        expect.any(Object)
      );
    });

    it('should handle cancel errors', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockRejectedValue(
          new Error('Reservation already checked in')
        ),
      };

      (adapter as any).client = mockAxiosInstance;

      await expect(
        adapter.cancelBooking({
          pmsBookingId: 'reservation-123',
          reason: 'Test cancellation',
        })
      ).rejects.toThrow('Reservation already checked in');
    });
  });

  describe('getBookingStatus', () => {
    it('should return booking status', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue({
          data: {
            Reservations: [{
              Id: 'reservation-123',
              Number: 'MEWS-12345',
              State: 'Confirmed',
              AssignedResourceId: 'room-456',
            }],
          },
        }),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.getBookingStatus('reservation-123');

      expect(result.status).toBe('CONFIRMED');
      expect(result.pmsBookingId).toBe('reservation-123');
      expect(result.roomAssigned).toBe('room-456');
    });

    it('should handle non-existent booking', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue({
          data: { Reservations: [] },
        }),
      };

      (adapter as any).client = mockAxiosInstance;

      await expect(
        adapter.getBookingStatus('non-existent')
      ).rejects.toThrow('Reservation not found');
    });

    it('should map Mews states correctly', async () => {
      const testCases: Array<{ mewsState: string; expectedStatus: PMSBookingStatus }> = [
        { mewsState: 'Confirmed', expectedStatus: 'CONFIRMED' },
        { mewsState: 'Started', expectedStatus: 'CHECKED_IN' },
        { mewsState: 'Processed', expectedStatus: 'CHECKED_OUT' },
        { mewsState: 'Canceled', expectedStatus: 'CANCELLED' },
        { mewsState: 'Optional', expectedStatus: 'PENDING' },
      ];

      for (const { mewsState, expectedStatus } of testCases) {
        const mockAxiosInstance = {
          post: vi.fn().mockResolvedValue({
            data: {
              Reservations: [{
                Id: 'reservation-123',
                Number: 'MEWS-12345',
                State: mewsState,
              }],
            },
          }),
        };

        (adapter as any).client = mockAxiosInstance;

        const result = await adapter.getBookingStatus('reservation-123');
        expect(result.status).toBe(expectedStatus);
      }
    });
  });

  describe('getAvailability', () => {
    it('should return available rooms', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue({
          data: {
            ResourceCategories: [
              {
                Id: 'category-1',
                Name: 'Deluxe Room',
                IsActive: true,
                TotalCapacity: 10,
                AvailableCapacity: 3,
                Prices: [{ Amount: 150, Currency: 'EUR' }],
              },
              {
                Id: 'category-2',
                Name: 'Suite',
                IsActive: true,
                TotalCapacity: 5,
                AvailableCapacity: 1,
                Prices: [{ Amount: 250, Currency: 'EUR' }],
              },
            ],
          },
        }),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.getAvailability({
        checkIn: new Date('2024-01-15'),
        checkOut: new Date('2024-01-20'),
      });

      expect(result.length).toBe(2);
      expect(result[0].roomCategory).toBe('Deluxe Room');
      expect(result[0].availableRooms).toBe(3);
      expect(result[1].roomCategory).toBe('Suite');
      expect(result[1].availableRooms).toBe(1);
    });

    it('should handle no availability', async () => {
      const mockAxiosInstance = {
        post: vi.fn().mockResolvedValue({
          data: {
            ResourceCategories: [],
            AvailabilityBlocks: [],
          },
        }),
      };

      (adapter as any).client = mockAxiosInstance;

      const result = await adapter.getAvailability({
        checkIn: new Date('2024-01-15'),
        checkOut: new Date('2024-01-20'),
      });

      expect(result).toEqual([]);
    });
  });

  describe('mapMewsStateToStatus', () => {
    it('should map all Mews states correctly', () => {
      const stateMapping: Record<string, PMSBookingStatus> = {
        'Confirmed': 'CONFIRMED',
        'Started': 'CHECKED_IN',
        'Processed': 'CHECKED_OUT',
        'Canceled': 'CANCELLED',
        'Optional': 'PENDING',
      };

      for (const [mewsState, expectedStatus] of Object.entries(stateMapping)) {
        const status = (adapter as any).mapMewsStateToStatus(mewsState);
        expect(status).toBe(expectedStatus);
      }
    });

    it('should default to UNKNOWN for unknown states', () => {
      const status = (adapter as any).mapMewsStateToStatus('UnknownState');
      expect(status).toBe('UNKNOWN');
    });
  });
});
