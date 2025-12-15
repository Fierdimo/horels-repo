// Force mock PMS adapter and peak dates for deterministic behavior
process.env.PMS_PROVIDER = 'mock';
process.env.USE_REAL_PMS = 'false';
process.env.MEWS_PEAK_DATES = process.env.MEWS_PEAK_DATES || '2025-12-01:2025-12-31';

import request from 'supertest';
import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import app from '../../src/app';
import sequelize from '../../src/config/database';
import { User, Role, Permission, RolePermission, Week, NightCredit, Property } from '../../src/models';
import jwt from 'jsonwebtoken';
import { pmsService } from '../../src/services/pmsServiceFactory';
import PmsMockService from '../../src/services/pmsMockService';

describe('E2E: Peak-period restriction for night-credit usage', () => {
  let jwtToken: string;
  let creditId: number;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';
    await sequelize.sync({ force: true });

    const perm = await Permission.create({ name: 'view_own_weeks' });
    const role = await Role.create({ name: 'owner' });
    await RolePermission.create({ role_id: role.id, permission_id: perm.id });

    const user = await User.create({ email: 'peak@example.com', password: 'x', role_id: role.id });

    // Create a property and week
    const property = await Property.create({ name: 'Peak Property', location: 'Peak City' });
    const week = await Week.create({ owner_id: user.id, property_id: property.id, start_date: new Date('2025-12-10'), end_date: new Date('2025-12-17'), color: 'red' });

    // Night credit that overlaps the MEWS_PEAK_DATES window
    const expiry = new Date(); expiry.setMonth(expiry.getMonth() + 6);
    const credit = await NightCredit.create({ owner_id: user.id, original_week_id: week.id, total_nights: 6, remaining_nights: 6, expiry_date: expiry, status: 'active' });
    creditId = credit.id;

    jwtToken = jwt.sign({ id: user.id }, process.env.JWT_SECRET!);

    // Force mock PMS behavior
    try {
      (pmsService as any).checkAvailability = PmsMockService.checkAvailability.bind(PmsMockService);
      (pmsService as any).createBooking = PmsMockService.createBooking.bind(PmsMockService);
    } catch (e) {
      // ignore override errors
    }
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it.skip('blocks night-credit usage when dates overlap configured peak period', async () => {
    // TODO: Implement peak-period validation in the backend
    // Currently the endpoint allows booking during peak periods
    const property = await Property.findOne({ where: { name: 'Peak Property' } });
    const res = await request(app)
      .post(`/timeshare/night-credits/${creditId}/use`)
      .set('Authorization', `Bearer ${jwtToken}`)
      .send({ propertyId: property!.id, checkIn: '2025-12-10', checkOut: '2025-12-12', roomType: 'standard' });

    // When implemented, should return 403, 409, or 422 with peak-period message
    expect([403, 409, 422]).toContain(res.status);
    const body = res.body || {};
    const reason = (body.reason || body.error || body.message || '').toString();
    expect(reason.toLowerCase()).toMatch(/peak[_\- ]?period|no availability/i);
  }, 20000);
});
