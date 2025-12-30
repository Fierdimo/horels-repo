// Ensure tests use the mock PMS adapter regardless of local .env
process.env.PMS_PROVIDER = 'mock';
process.env.USE_REAL_PMS = 'false';

import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import app from '../../src/app';
import { pmsService } from '../../src/services/pmsServiceFactory';
import PmsMockService from '../../src/services/pmsMockService';
import sequelize from '../../src/config/database';
import { User, Role, Permission, RolePermission, Week, NightCredit, Booking, Property } from '../../src/models';
import jwt from 'jsonwebtoken';

describe('E2E: Night-credit idempotency and persistence', () => {
  let jwtToken: string;
  let creditId: number;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    // Ensure DB schema exists for tests
    await sequelize.sync({ force: true });

    // Create permission and role
    const perm = await Permission.create({ name: 'view_own_weeks' });
    const role = await Role.create({ name: 'owner' });
    await RolePermission.create({ role_id: role.id, permission_id: perm.id });

    // Create user with owner role
    const user = await User.create({ email: 'owner@example.com', password: 'x', role_id: role.id });

    // Create a property and week for that user
    await Property.create({ 
      name: 'Test Property', 
      location: 'Test City',
      tier: 'STANDARD',
      location_multiplier: 1.00
    });
    const week = await Week.create({ owner_id: user.id, property_id: '1', start_date: new Date(), end_date: new Date(), color: 'red' });

    // Create night credit
    const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 6);
    const credit = await NightCredit.create({ owner_id: user.id, original_week_id: week.id, total_nights: 6, remaining_nights: 6, expiry_date: expiry, status: 'active' });
    creditId = credit.id;

    // Create JWT
    jwtToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);

    // Ensure the running pmsService uses the mock implementations for tests
    try {
      (pmsService as any).checkAvailability = PmsMockService.checkAvailability.bind(PmsMockService);
      (pmsService as any).createBooking = PmsMockService.createBooking.bind(PmsMockService);
    } catch (e) {
      // ignore if unable to override (tests will fail earlier)
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('uses night credits and persists booking & idempotency, then is idempotent on retry', async () => {
    const idempotencyKey = 'test-idem-1234';

    // First request: should create booking and decrement credit
    const res1 = await request(app)
      .post(`/timeshare/night-credits/${creditId}/use`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ propertyId: '1', checkIn: '2025-12-10', checkOut: '2025-12-12', roomType: 'standard' })
      .expect(200);

    expect(res1.body).toHaveProperty('success', true);
    expect(res1.body.data).toHaveProperty('booking');
    const booking1 = res1.body.data.booking;
    expect(booking1).toHaveProperty('pms_booking_id');
    expect(booking1).toHaveProperty('idempotency_key', idempotencyKey);

    // Verify DB record exists and night credit decremented
    const dbBooking = await Booking.findOne({ where: { id: booking1.id } });
    expect(dbBooking).toBeTruthy();
    expect(dbBooking?.pms_booking_id).toBe(booking1.pms_booking_id);
    expect(dbBooking?.idempotency_key).toBe(idempotencyKey);

    const creditAfter = await NightCredit.findByPk(creditId);
    expect(creditAfter).toBeTruthy();
    expect(creditAfter?.remaining_nights).toBeLessThan(6);

    // Second request: same idempotency key -> should return existing booking and not decrement again
    const res2 = await request(app)
      .post(`/timeshare/night-credits/${creditId}/use`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send({ propertyId: 1, checkIn: '2025-12-10', checkOut: '2025-12-12', roomType: 'standard' })
      .expect(200);

    expect(res2.body).toHaveProperty('success', true);
    expect(res2.body.message).toMatch(/Idempotent/i);

    const creditAfter2 = await NightCredit.findByPk(creditId);
    expect(creditAfter2?.remaining_nights).toBe(creditAfter?.remaining_nights);
  }, 20000);
});
