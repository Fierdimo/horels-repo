import 'dotenv/config';
process.env.DB_NAME = process.env.DB_NAME || 'sw2_e2e_test';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import sequelize from '../src/config/database';
import Role from '../src/models/Role';
import Permission from '../src/models/Permission';
import RolePermission from '../src/models/RolePermission';
import User from '../src/models/User';
import bcrypt from 'bcryptjs';

let app: any;

describe('Swap fee admin endpoints', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    app = (await import('../src/app')).default;
    await sequelize.authenticate();
    try { await sequelize.drop({ cascade: true }); } catch (e) {}
    await sequelize.sync({ force: true });

    const [adminRole] = await Role.findOrCreate({ where: { name: 'admin' } });
    const [userRole] = await Role.findOrCreate({ where: { name: 'owner' } });

    const perms = [];
    for (const p of perms) {
      const [perm] = await Permission.findOrCreate({ where: { name: p } });
      await RolePermission.findOrCreate({ where: { role_id: adminRole.id, permission_id: perm.id } });
    }

    const adminHashed = await bcrypt.hash('admin123', 10);
    await User.findOrCreate({ where: { email: 'admin@sw2.com' }, defaults: { email: 'admin@sw2.com', password: adminHashed, role_id: adminRole.id } });

    const userHashed = await bcrypt.hash('user123', 10);
    await User.findOrCreate({ where: { email: 'user@sw2.com' }, defaults: { email: 'user@sw2.com', password: userHashed, role_id: userRole.id } });

    const loginAdmin = await request(app).post('/auth/login').send({ email: 'admin@sw2.com', password: 'admin123' });
    adminToken = loginAdmin.body.token;

    const loginUser = await request(app).post('/auth/login').send({ email: 'user@sw2.com', password: 'user123' });
    userToken = loginUser.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('allows admin to set and get swap_fee', async () => {
    const setRes = await request(app)
      .post('/conversion/swap-fee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee: 15 });
    expect(setRes.status).toBe(200);
    expect(setRes.body.data?.fee).toBe(15);

    const getRes = await request(app)
      .get('/conversion/swap-fee')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data?.fee).toBe(15);
  });

  it('prevents non-admin from setting fee', async () => {
    const res = await request(app)
      .post('/conversion/swap-fee')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ fee: 20 });
    expect(res.status).toBe(403);
  });
});
