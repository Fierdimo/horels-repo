import request from 'supertest';
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, test } from 'vitest';
import app from '../src/app';
import sequelize from '../src/config/database';
import Booking from '../src/models/Booking';
import HotelService from '../src/models/HotelService';
import Property from '../src/models/Property';
import { setupTestDatabase } from './testHelpers';

describe('Hotel Guest API Integration', () => {
  let guestToken: string;
  let bookingId: number;
  let propertyId: string;
  const testId = Date.now().toString();

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    
    // Create test property with unique ID
    const property = await Property.create({
      name: 'Test Hotel',
      location: 'Test City',
      latitude: 40.7128,
      longitude: -74.0060
    });
    propertyId = property.id;

    // Create test booking with unique token
    const booking = await Booking.create({
      property_id: propertyId,
      guest_name: 'John Doe',
      guest_email: 'john.doe@test.com',
      check_in: new Date('2025-11-01'),
      check_out: new Date('2025-11-08'), // Within 30 days of current date
      room_type: 'Deluxe Room',
      status: 'confirmed',
      guest_token: `test-guest-token-${testId}`,
      total_amount: 800.00,
      currency: 'EUR'
    });
    bookingId = booking.id;
    guestToken = booking.guest_token;
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await Booking.destroy({ where: { guest_token: guestToken } });
      await Property.destroy({ where: { id: propertyId } });
      await HotelService.destroy({ where: { booking_id: bookingId } });
    } catch (error) {
      // Ignore cleanup errors
    }
    await sequelize.close();
  });

  describe('Booking Access', () => {
    test('should get booking details with token', async () => {
      const response = await request(app)
        .get(`/hotel/booking/${guestToken}`);

      expect(response.status).toBe(200);
      expect(response.body.booking).toBeDefined();
      expect(response.body.booking.guest_name).toBe('John Doe');
      expect(response.body.booking.guest_email).toBe('john.doe@test.com');
      expect(response.body.hotel).toBeDefined();
    });

    test('should reject invalid token', async () => {
      const response = await request(app)
        .get('/hotel/booking/invalid-token');

      expect(response.status).toBe(404);
      expect(response.body.error).toContain('not found');
    });
  });

  describe('Service Requests', () => {
    test('should create service request', async () => {
      const response = await request(app)
        .post('/hotel/services')
        .send({
          bookingToken: guestToken,
          serviceType: 'late_checkout',
          description: 'Need late checkout until 6 PM',
          urgency: 'medium'
        });

      expect(response.status).toBe(201);
      expect(response.body.serviceRequest).toBeDefined();
      expect(response.body.serviceRequest.service_type).toBe('late_checkout');
      expect(response.body.serviceRequest.status).toBe('requested');
    });

    test('should get service requests for booking', async () => {
      const response = await request(app)
        .get(`/hotel/services/${guestToken}`);

      expect(response.status).toBe(200);
      expect(response.body.services).toBeDefined();
      expect(Array.isArray(response.body.services)).toBe(true);
      expect(response.body.services.length).toBeGreaterThan(0);
    });

    test('should reject service request with invalid token', async () => {
      const response = await request(app)
        .post('/hotel/services')
        .send({
          bookingToken: 'invalid-token',
          serviceType: 'room_cleaning',
          description: 'Extra cleaning needed'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('invalid');
    });
  });

  describe('Secret World Integration', () => {
    test('should get nearby content', async () => {
      const response = await request(app)
        .get(`/hotel/nearby/${guestToken}`)
        .query({ radius: 10 });

      expect(response.status).toBe(200);
      expect(response.body.content).toBeDefined();
      expect(response.body.location).toBeDefined();
      expect(response.body.location.latitude).toBe(40.7128);
      expect(response.body.location.longitude).toBe(-74.0060);
    });

    test('should handle nearby content with default radius', async () => {
      const response = await request(app)
        .get(`/hotel/nearby/${guestToken}`);

      expect(response.status).toBe(200);
      expect(response.body.content).toBeDefined();
    });
  });

  describe('Access Control', () => {
    test('should reject expired booking access', async () => {
      // Create booking that "expired" (checkout more than 30 days ago)
      const expiredBooking = await Booking.create({
        property_id: propertyId,
        guest_name: 'Expired Guest',
        guest_email: 'expired@test.com',
        check_in: new Date('2024-01-01'),
        check_out: new Date('2024-01-08'), // More than 30 days ago
        room_type: 'Standard Room',
        status: 'checked_out',
        guest_token: `expired-token-${testId}`,
        total_amount: 500.00
      });

      const response = await request(app)
        .get(`/hotel/booking/${expiredBooking.guest_token}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toContain('expired');

      // Clean up
      await Booking.destroy({ where: { guest_token: expiredBooking.guest_token } });
    });

    test('should allow access within 30 days post-checkout', async () => {
      // Create booking within 30 days of checkout
      const now = new Date();
      const recentCheckOut = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)); // 15 days ago
      const recentCheckIn = new Date(recentCheckOut.getTime() - (7 * 24 * 60 * 60 * 1000)); // 7 days before checkout

      const recentBooking = await Booking.create({
        property_id: propertyId,
        guest_name: 'Recent Guest',
        guest_email: 'recent@test.com',
        check_in: recentCheckIn,
        check_out: recentCheckOut,
        room_type: 'Suite',
        status: 'checked_out',
        guest_token: `recent-token-${testId}`,
        total_amount: 1200.00
      });

      const response = await request(app)
        .get(`/hotel/booking/${recentBooking.guest_token}`);

      expect(response.status).toBe(200);
      expect(response.body.booking).toBeDefined();

      // Clean up
      await Booking.destroy({ where: { guest_token: recentBooking.guest_token } });
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed requests', async () => {
      const response = await request(app)
        .post('/hotel/services')
        .send({
          // Missing required fields
          bookingToken: guestToken
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });

    test('should handle database errors gracefully', async () => {
      // Force a database error by using invalid data
      const response = await request(app)
        .post('/hotel/services')
        .send({
          bookingToken: guestToken,
          serviceType: '', // Invalid empty service type
          description: 'Test service'
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toBeDefined();
    });
  });
});