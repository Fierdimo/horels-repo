import 'dotenv/config';
process.env.DB_NAME = process.env.DB_NAME || 'sw2_e2e_test';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import sequelize from '../src/config/database';
import Role from '../src/models/Role';
import Permission from '../src/models/Permission';
import RolePermission from '../src/models/RolePermission';
import User from '../src/models/User';
import Property from '../src/models/Property';
import Week from '../src/models/Week';
import NightCredit from '../src/models/NightCredit';
import bcrypt from 'bcryptjs';

let app: any;

describe('Conversion to Night Credits', () => {
  let owner: any;
  let ownerToken: string;
  let propertyId: string;

  beforeAll(async () => {
    app = (await import('../src/app')).default;
    await sequelize.authenticate();
    try { await sequelize.drop({ cascade: true }); } catch (e) {}
    await sequelize.sync({ force: true });

    const [ownerRole] = await Role.findOrCreate({ where: { name: 'owner' } });
    const [guestRole] = await Role.findOrCreate({ where: { name: 'guest' } });
    const perms = ['view_own_weeks'];
    for (const p of perms) {
      const [perm] = await Permission.findOrCreate({ where: { name: p } });
      await RolePermission.findOrCreate({ where: { role_id: ownerRole.id, permission_id: perm.id } });
    }

    const hashed = await bcrypt.hash('Password123!', 10);
    [owner] = await User.findOrCreate({ where: { email: 'credit-owner@test.com' }, defaults: { email: 'credit-owner@test.com', password: hashed, role_id: ownerRole.id } });

    const prop = await Property.create({ name: 'Credit Hotel', location: 'Test City' });
    propertyId = prop.id;

    const login = await request(app).post('/auth/login').send({ email: owner.email, password: 'Password123!' });
    ownerToken = login.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('converts a red week into 6 night credits with expiry between 18-24 months', async () => {
    const start = new Date('2026-06-01');
    const end = new Date('2026-06-07');
    const week = await Week.create({ owner_id: owner.id, property_id: propertyId, start_date: start, end_date: end, color: 'red', status: 'available' });

    const res = await request(app)
      .post(`/timeshare/weeks/${week.id}/convert`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect([200,201]).toContain(res.status);
    expect(res.body.data).toBeTruthy();
    const nc = res.body.data?.nightCredit;
    expect(nc).toBeTruthy();
    expect(Number(nc.total_nights || nc.nights || nc.totalNights)).toBe(6);

    // expiry check: between 18 and 24 months from now
    const expiry = new Date(nc.expiry_date || nc.expiryDate || nc.expires_at || nc.expiry_date);
    const now = new Date();
    const months = (expiry.getFullYear() - now.getFullYear()) * 12 + (expiry.getMonth() - now.getMonth());
    expect(months).toBeGreaterThanOrEqual(18);
    expect(months).toBeLessThanOrEqual(24);

    // DB record check
    const db = await NightCredit.findByPk(nc.id || nc.ID || nc.id);
    expect(db).toBeTruthy();
    if (db) expect(Number((db as any).total_nights || (db as any).nights || (db as any).totalNights)).toBe(6);
  });
});
