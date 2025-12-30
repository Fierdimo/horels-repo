import request from 'supertest';
import app from '../src/app';
import { User, Property, Booking, HotelService, Role } from '../src/models';
import sequelize from '../src/config/database';

let staffToken: string;
let property: any;
let booking: any;
let service: any;

beforeAll(async () => {
  await sequelize.sync({ force: true });
  // Create roles
  const staffRole = await Role.create({ name: 'staff' });
  // Create property
  property = await Property.create({ 
    name: 'Test Hotel', 
    location: 'Test City', 
    coordinates: '{"lat":0,"lng":0}',
    tier: 'STANDARD',
    location_multiplier: 1.00
  });
  // Create staff user
  const staffUser = await User.create({
    email: 'staff@test.com',
    password: 'password',
    role_id: staffRole.id,
    property_id: property.id
  });
  // Simulate login (bypass real auth for test)
  staffToken = require('jsonwebtoken').sign({ id: staffUser.id }, process.env.JWT_SECRET || 'testsecret');
  // Create booking
  booking = await Booking.create({
    property_id: property.id,
    guest_name: 'Guest',
    guest_email: 'guest@test.com',
    check_in: new Date(),
    check_out: new Date(Date.now() + 86400000),
    room_type: 'standard',
    status: 'confirmed',
    guest_token: 'tokentest123'
  });
  // Create hotel service
  service = await HotelService.create({
    booking_id: booking.id,
    service_type: 'cleaning',
    status: 'requested',
    quantity: 1,
    notes: 'Initial cleaning',
    requested_at: new Date()
  });
});

describe('Hotel Staff Endpoints', () => {
  it('should list all service requests for staff hotel', async () => {
    const res = await request(app)
      .get('/hotel-staff/services')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(res.body.services.length).toBeGreaterThan(0);
  });

  it('should update the status of a service request', async () => {
    const res = await request(app)
      .patch(`/hotel-staff/services/${service.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'confirmed' });
    expect(res.status).toBe(200);
    expect(res.body.service.status).toBe('confirmed');
  });

  it('should return service history for staff hotel', async () => {
    const res = await request(app)
      .get('/hotel-staff/services/history')
      .set('Authorization', `Bearer ${staffToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.services)).toBe(true);
    expect(res.body.services.length).toBeGreaterThan(0);
  });

  it('should not allow access without staff token', async () => {
    const res = await request(app)
      .get('/hotel-staff/services');
    expect(res.status).toBe(401);
  });

  it('should not allow status update with invalid status', async () => {
    const res = await request(app)
      .patch(`/hotel-staff/services/${service.id}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .send({ status: 'invalid_status' });
    expect(res.status).toBe(400);
  });
});
