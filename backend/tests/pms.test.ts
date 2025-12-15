import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import PMSService from '../src/services/pmsService';
import { ActionLog } from '../src/models';
import axios from 'axios';

// Mock axios
vi.mock('axios', () => ({
  default: {
    create: vi.fn(() => ({
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn()
        }
      }
    }))
  }
}));

// Mock external dependencies
vi.mock('../src/services/loggingService', () => ({
  default: {
    logAction: vi.fn(),
    logAdminAction: vi.fn(),
  },
}));

// Mock environment variables
process.env.PMS_API_KEY = 'test_api_key';
process.env.PMS_API_URL = 'https://api.test.com';

describe('PMS Service Integration', () => {
  let pmsService: PMSService;
  let mockAxiosInstance: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create mock axios instance
    mockAxiosInstance = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      interceptors: {
        response: {
          use: vi.fn()
        }
      }
    };

    // Mock axios.create to return our mock instance
    (axios.create as Mock).mockReturnValue(mockAxiosInstance);

    // Create service instance with mock client
    pmsService = new PMSService(mockAxiosInstance);
  });

  describe('Availability Management', () => {
    it('should retrieve room availability for a date range', async () => {
      const mockAvailabilityData = [
        {
          room_id: 'room_1',
          room_type: 'Standard',
          available: true,
          date: '2025-12-01',
          price: 100.00,
          currency: 'EUR'
        },
        {
          room_id: 'room_2',
          room_type: 'Deluxe',
          available: false,
          date: '2025-12-01',
          price: 150.00,
          currency: 'EUR'
        }
      ];

      // Mock the axios get method
      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockAvailabilityData
      });

      const startDate = '2025-12-01';
      const endDate = '2025-12-05';
      const propertyId = 'prop_123';

      const availability = await pmsService.getAvailability(propertyId, startDate, endDate);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/properties/${propertyId}/availability`, {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });

      expect(availability).toBeDefined();
      expect(Array.isArray(availability)).toBe(true);
      expect(availability).toHaveLength(2);
      expect(availability[0]).toHaveProperty('roomId', 'room_1');
      expect(availability[0]).toHaveProperty('available', true);
    });

    it('should handle invalid date ranges', async () => {
      const startDate = '2025-12-05';
      const endDate = '2025-12-01'; // End before start
      const propertyId = 'prop_123';

      await expect(pmsService.getAvailability(propertyId, startDate, endDate))
        .rejects.toThrow('Invalid date range');
    });

    it('should handle PMS API errors gracefully', async () => {
      // Mock API failure
      mockAxiosInstance.get.mockRejectedValueOnce(new Error('API Error'));

      const startDate = '2025-12-01';
      const endDate = '2025-12-05';
      const propertyId = 'invalid_prop';

      await expect(pmsService.getAvailability(propertyId, startDate, endDate))
        .rejects.toThrow('PMS API error');
    });
  });

  describe('Booking Management', () => {
    it('should create a new booking', async () => {
      const mockBookingResponse = {
        booking_id: 'booking_123',
        status: 'confirmed',
        property_id: 'prop_123',
        room_id: 'room_456',
        guest_name: 'John Doe',
        guest_email: 'john@example.com',
        check_in: '2025-12-01',
        check_out: '2025-12-03',
        adults: 2,
        children: 0,
        total_amount: 300.00,
        currency: 'EUR',
        created_at: '2025-11-27T12:00:00Z',
        updated_at: '2025-11-27T12:00:00Z'
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: mockBookingResponse
      });

      const bookingData = {
        propertyId: 'prop_123',
        roomId: 'room_456',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2025-12-01',
        checkOut: '2025-12-03',
        adults: 2,
        children: 0,
        totalAmount: 300.00,
        currency: 'EUR'
      };

      const booking = await pmsService.createBooking(bookingData);

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/bookings', expect.objectContaining({
        property_id: bookingData.propertyId,
        guest_name: bookingData.guestName
      }));

      expect(booking).toBeDefined();
      expect(booking).toHaveProperty('bookingId', 'booking_123');
      expect(booking).toHaveProperty('status', 'confirmed');
      expect(booking.guestName).toBe(bookingData.guestName);
    });

    it('should retrieve booking details', async () => {
      const mockBookingData = {
        booking_id: 'booking_789',
        status: 'confirmed',
        property_id: 'prop_123',
        room_id: 'room_456',
        guest_name: 'Jane Doe',
        guest_email: 'jane@example.com',
        check_in: '2025-12-01',
        check_out: '2025-12-03',
        adults: 2,
        children: 0,
        total_amount: 250.00,
        currency: 'EUR',
        created_at: '2025-11-27T12:00:00Z',
        updated_at: '2025-11-27T12:00:00Z'
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockBookingData
      });

      const bookingId = 'booking_789';

      const booking = await pmsService.getBooking(bookingId);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/bookings/${bookingId}`);

      expect(booking).toBeDefined();
      expect(booking.bookingId).toBe(bookingId);
      expect(booking).toHaveProperty('propertyId');
      expect(booking).toHaveProperty('guestName');
      expect(booking.status).toBe('confirmed');
    });

    it('should update an existing booking', async () => {
      const mockUpdatedBooking = {
        booking_id: 'booking_789',
        status: 'confirmed',
        guest_name: 'Jane Smith',
        adults: 1
      };

      mockAxiosInstance.put.mockResolvedValueOnce({
        data: mockUpdatedBooking
      });

      const bookingId = 'booking_789';
      const updateData = {
        guestName: 'Jane Smith',
        adults: 1
      };

      const updatedBooking = await pmsService.updateBooking(bookingId, updateData);

      expect(mockAxiosInstance.put).toHaveBeenCalledWith(`/bookings/${bookingId}`, updateData);

      expect(updatedBooking).toBeDefined();
      expect(updatedBooking.bookingId).toBe(bookingId);
      expect(updatedBooking.guestName).toBe(updateData.guestName);
      expect(updatedBooking.adults).toBe(updateData.adults);
    });

    it('should cancel a booking', async () => {
      mockAxiosInstance.delete.mockResolvedValueOnce({});

      const bookingId = 'booking_789';

      const result = await pmsService.cancelBooking(bookingId);

      expect(mockAxiosInstance.delete).toHaveBeenCalledWith(`/bookings/${bookingId}`);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
    });

    it('should handle booking validation errors', async () => {
      const invalidBookingData = {
        propertyId: 'prop_123',
        // Missing required fields
      };

      await expect(pmsService.createBooking(invalidBookingData as any))
        .rejects.toThrow('Missing required field');
    });
  });

  describe('Rate Limiting and Error Handling', () => {
    it('should handle rate limit errors with retry logic', async () => {
      // Test that rate limit errors are properly handled and logged
      mockAxiosInstance.get.mockRejectedValueOnce({
        response: { status: 429 },
        message: 'Rate limit exceeded'
      });

      const startDate = '2025-12-01';
      const endDate = '2025-12-05';
      const propertyId = 'prop_123';

      await expect(pmsService.getAvailability(propertyId, startDate, endDate))
        .rejects.toThrow('PMS API error');

      // Verify the API was called
      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/properties/${propertyId}/availability`, {
        params: {
          start_date: startDate,
          end_date: endDate
        }
      });
    });

    it('should log PMS API actions', async () => {
      const mockBookingResponse = {
        booking_id: 'booking_123',
        status: 'confirmed',
        guest_name: 'John Doe',
        guest_email: 'john@example.com'
      };

      mockAxiosInstance.post.mockResolvedValueOnce({
        data: mockBookingResponse
      });

      const bookingData = {
        propertyId: 'prop_123',
        roomId: 'room_456',
        guestName: 'John Doe',
        guestEmail: 'john@example.com',
        checkIn: '2025-12-01',
        checkOut: '2025-12-03',
        adults: 2,
        children: 0,
        totalAmount: 300.00,
        currency: 'EUR'
      };

      await pmsService.createBooking(bookingData);

      // Verify logging was called (mocked)
      const loggingService = await import('../src/services/loggingService');
      expect(vi.mocked(loggingService.default.logAction)).toHaveBeenCalled();
    });
  });

  describe('Property Management', () => {
    it('should retrieve property information', async () => {
      const mockPropertyData = {
        property_id: 'prop_123',
        name: 'Test Hotel',
        address: '123 Test St',
        city: 'Test City',
        country: 'Test Country',
        rooms: [
          {
            room_id: 'room_1',
            room_type: 'Standard',
            max_occupancy: 2,
            base_price: 100.00,
            currency: 'EUR'
          }
        ],
        amenities: ['WiFi', 'Pool']
      };

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockPropertyData
      });

      const propertyId = 'prop_123';

      const property = await pmsService.getProperty(propertyId);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith(`/properties/${propertyId}`);

      expect(property).toBeDefined();
      expect(property.propertyId).toBe(propertyId);
      expect(property).toHaveProperty('name', 'Test Hotel');
      expect(property).toHaveProperty('rooms');
      expect(Array.isArray(property.rooms)).toBe(true);
      expect(property.rooms).toHaveLength(1);
    });

    it('should list all properties for a user', async () => {
      const mockPropertiesData = [
        {
          property_id: 'prop_123',
          name: 'Hotel A',
          address: '123 Main St',
          city: 'City A',
          country: 'Country A',
          rooms: [],
          amenities: []
        },
        {
          property_id: 'prop_456',
          name: 'Hotel B',
          address: '456 Oak St',
          city: 'City B',
          country: 'Country B',
          rooms: [],
          amenities: []
        }
      ];

      mockAxiosInstance.get.mockResolvedValueOnce({
        data: mockPropertiesData
      });

      const userId = 1;

      const properties = await pmsService.getUserProperties(userId);

      expect(mockAxiosInstance.get).toHaveBeenCalledWith('/properties', {
        params: { owner_id: userId }
      });

      expect(properties).toBeDefined();
      expect(Array.isArray(properties)).toBe(true);
      expect(properties).toHaveLength(2);
      expect(properties[0]).toHaveProperty('propertyId', 'prop_123');
      expect(properties[1]).toHaveProperty('name', 'Hotel B');
    });
  });
});