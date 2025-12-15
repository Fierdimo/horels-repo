import request from 'supertest';
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import app from '../src/app';
import { setupTestDatabase } from './testHelpers';
import Booking from '../src/models/Booking';
import HotelService from '../src/models/HotelService';
import Property from '../src/models/Property';
import sequelize from '../src/config/database';

describe('Guest token lifecycle - create & access', () => {
  let guestToken: string;
  let propertyId: string;

  beforeAll(async () => {
    await setupTestDatabase();

    // create a property and booking directly (simpler than going through authenticated PMS route)
    const prop = await Property.create({
      name: 'Test Property',
      location: 'Test City',
      latitude: 40.7128,
      longitude: -74.0060
    });
    propertyId = prop.id;

    const booking = await Booking.create({
      property_id: propertyId,
      guest_name: 'Guest Tester',
      guest_email: 'guest@test.com',
      check_in: new Date(),
      check_out: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000), // 3 days from now
      room_type: 'Standard',
      status: 'confirmed',
      guest_token: `guest-token-${Date.now()}`,
      total_amount: 300.00,
      currency: 'EUR'
    });

    guestToken = booking.guest_token;
  });

  afterAll(async () => {
    try {
      await Booking.destroy({ where: { guest_token: guestToken } });
      await Property.destroy({ where: { id: propertyId } });
    } catch (e) {
      // ignore cleanup errors
    }
    await sequelize.close();
  });

  test('creates booking (via model) and returns a guest token that grants access', async () => {
    // Access booking via guest token
    const res = await request(app).get(`/hotel/booking/${guestToken}`);
    expect(res.status).toBe(200);
    expect(res.body.booking).toBeDefined();
    expect(res.body.booking.guest_name).toBe('Guest Tester');
    expect(res.body.booking.guest_email).toBe('guest@test.com');
    expect(res.body.hotel).toBeDefined();
  });

  test('allows access within 30 days post-checkout', async () => {
    const now = new Date();
    const recentCheckOut = new Date(now.getTime() - (15 * 24 * 60 * 60 * 1000)); // 15 days ago
    const recentCheckIn = new Date(recentCheckOut.getTime() - (3 * 24 * 60 * 60 * 1000)); // 3 days before checkout

    const recentBooking = await Booking.create({
      property_id: propertyId,
      guest_name: 'Recent Guest',
      guest_email: 'recent@test.com',
      check_in: recentCheckIn,
      check_out: recentCheckOut,
      room_type: 'Suite',
      status: 'checked_out',
      guest_token: `recent-token-${Date.now()}`,
      total_amount: 1200.00,
      currency: 'EUR'
    });

    const res = await request(app).get(`/hotel/booking/${recentBooking.guest_token}`);
    expect(res.status).toBe(200);
    expect(res.body.booking).toBeDefined();

    // cleanup
    await Booking.destroy({ where: { guest_token: recentBooking.guest_token } });
  });

  test('rejects access after 30 days from checkout', async () => {
    const expiredBooking = await Booking.create({
      property_id: propertyId,
      guest_name: 'Expired Guest',
      guest_email: 'expired@test.com',
      check_in: new Date('2024-01-01'),
      check_out: new Date('2024-01-08'),
      room_type: 'Standard',
      status: 'checked_out',
      guest_token: `expired-token-${Date.now()}`,
      total_amount: 500.00,
      currency: 'EUR'
    });

    const res = await request(app).get(`/hotel/booking/${expiredBooking.guest_token}`);
    expect(res.status).toBe(403);

    await Booking.destroy({ where: { guest_token: expiredBooking.guest_token } });
  });

  test('allows creating service requests using guest token', async () => {
    const payload = {
      bookingToken: guestToken,
      serviceType: 'late_checkout',
      description: 'Need late checkout until 6 PM',
      urgency: 'medium'
    };

    const postRes = await request(app).post('/hotel/services').send(payload);
    expect(postRes.status).toBe(201);
    expect(postRes.body.serviceRequest).toBeDefined();
    expect(postRes.body.serviceRequest.service_type).toBe('late_checkout');

    const getRes = await request(app).get(`/hotel/services/${guestToken}`);
    expect(getRes.status).toBe(200);
    expect(Array.isArray(getRes.body.services)).toBe(true);
    expect(getRes.body.services.length).toBeGreaterThan(0);

    // cleanup created service requests
    await HotelService.destroy({ where: { booking_id: postRes.body.serviceRequest.id } }).catch(() => {});
  });

  test('rejects service request with invalid token', async () => {
    const res = await request(app).post('/hotel/services').send({
      bookingToken: 'invalid-token',
      serviceType: 'room_cleaning',
      description: 'Extra cleaning needed'
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  test('creates paid service request and returns payment clientSecret', async () => {
    const payload = {
      bookingToken: guestToken,
      serviceType: 'premium_parking',
      description: 'Reserved parking spot',
      amount: 25.00,
      currency: 'EUR'
    };

    const postRes = await request(app).post('/hotel/services').send(payload);
    expect(postRes.status).toBe(201);
    expect(postRes.body.serviceRequest).toBeDefined();
    expect(postRes.body.serviceRequest.price).toBe(25.00);
    expect(postRes.body.payment).toBeDefined();
    expect(postRes.body.payment.clientSecret).toBeDefined();

    // Clean up: remove created service
    await HotelService.destroy({ where: { booking_id: postRes.body.serviceRequest.id } }).catch(() => {});
  });
});

