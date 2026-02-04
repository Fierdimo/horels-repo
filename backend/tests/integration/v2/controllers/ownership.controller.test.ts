/**
 * OwnershipController Integration Tests (Phase 3.5)
 * 
 * Tests HTTP endpoints for ownership management (admin operations).
 * Uses vitest + supertest for API testing.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../../src/app';
import sequelize from '../../../../src/config/database';
import User from '../../../../src/models/User';
import Role from '../../../../src/models/Role';
import { initV2Models } from '../../../../src/models/v2';
import TimeshareProperty from '../../../../src/models/v2/TimeshareProperty';
import TimeshareUnit from '../../../../src/models/v2/TimeshareUnit';
import Ownership from '../../../../src/models/v2/Ownership';
import WeekAllocation from '../../../../src/models/v2/WeekAllocation';
import jwt from 'jsonwebtoken';

describe('OwnershipController Integration Tests', () => {
  let testUser: User;
  let adminUser: User;
  let testProperty: TimeshareProperty;
  let testUnit: TimeshareUnit;
  let testOwnership: Ownership;
  let userToken: string;
  let adminToken: string;

  beforeAll(async () => {
    await sequelize.authenticate();
    initV2Models(sequelize);
  });

  beforeEach(async () => {
    // Clean up
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await WeekAllocation.destroy({ where: {}, truncate: true, force: true });
    await Ownership.destroy({ where: {}, truncate: true, force: true });
    await TimeshareUnit.destroy({ where: {}, truncate: true, force: true });
    await TimeshareProperty.destroy({ where: {}, truncate: true, force: true });
    await User.destroy({ where: {}, truncate: true, force: true });
    await Role.destroy({ where: {}, truncate: true, force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create roles
    const userRole = await Role.create({
      name: 'user',
      description: 'Regular user',
    });

    const adminRole = await Role.create({
      name: 'admin',
      description: 'Administrator',
    });

    // Create regular user
    testUser = await User.create({
      email: 'owner@test.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'Owner',
      role_id: userRole.id,
      status: 'approved',
    });

    // Create admin user
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'hashedpassword',
      firstName: 'Admin',
      lastName: 'User',
      role_id: adminRole.id,
      status: 'approved',
    });

    // Generate tokens
    userToken = jwt.sign(
      { id: testUser.id, email: testUser.email, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: 'admin' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test property
    testProperty = await TimeshareProperty.create({
      name: 'Beach Resort Test',
      slug: 'beach-resort-test',
      location: 'Marbella, Spain',
      address: '123 Beach Ave',
      country: 'ES',
      description: 'Test resort',
      contact_email: 'info@beachresort.com',
      contact_phone: '+34600000000',
      check_in_time: '15:00',
      check_out_time: '11:00',
      pms_provider: 'mews',
      pms_property_id: 'MEWS-123',
      is_active: true,
    });

    // Create test unit
    testUnit = await TimeshareUnit.create({
      property_id: testProperty.id,
      name: 'Apartment 2BR',
      slug: 'apartment-2br',
      category: '2BR',
      bedrooms: 2,
      bathrooms: 2,
      capacity: 4,
      quantity: 10,
      base_credit_value: 1000,
      currency: 'EUR',
      is_active: true,
    });

    // Create test ownership
    testOwnership = await Ownership.create({
      owner_id: testUser.id,
      unit_id: testUnit.id,
      type: 'FIXED_WEEK',
      fixed_week_number: 25,
      contract_start_year: 2026,
      contract_end_year: 2036,
      annual_fee: 500,
      currency: 'EUR',
      status: 'ACTIVE',
    });

    // Create week allocations
    await WeekAllocation.create({
      ownership_id: testOwnership.id,
      year: 2026,
      week_number: 25,
      start_date: new Date('2026-06-15'),
      end_date: new Date('2026-06-22'),
      status: 'ASSIGNED',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/v2/ownerships', () => {
    it('should create ownership (admin only)', async () => {
      const response = await request(app)
        .post('/api/v2/ownerships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ownerId: testUser.id,
          unitId: testUnit.id,
          type: 'FLOATING',
          annualPoints: 1000,
          contractStartYear: 2026,
          contractEndYear: 2036,
          annualFee: 600,
          currency: 'EUR',
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        type: 'FLOATING',
        annual_points: 1000,
        status: 'ACTIVE',
      });
    });

    it('should return 403 for non-admin user', async () => {
      const response = await request(app)
        .post('/api/v2/ownerships')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          ownerId: testUser.id,
          unitId: testUnit.id,
          type: 'FIXED_WEEK',
          fixedWeekNumber: 30,
          contractStartYear: 2026,
          annualFee: 500,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Admin access required');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/v2/ownerships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ownerId: testUser.id,
          // Missing unitId
          type: 'FIXED_WEEK',
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate FIXED_WEEK requires fixedWeekNumber', async () => {
      const response = await request(app)
        .post('/api/v2/ownerships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ownerId: testUser.id,
          unitId: testUnit.id,
          type: 'FIXED_WEEK',
          // Missing fixedWeekNumber
          contractStartYear: 2026,
          annualFee: 500,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('fixedWeekNumber');
    });

    it('should validate POINTS requires annualPoints', async () => {
      const response = await request(app)
        .post('/api/v2/ownerships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ownerId: testUser.id,
          unitId: testUnit.id,
          type: 'POINTS',
          // Missing annualPoints
          contractStartYear: 2026,
          annualFee: 500,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('annualPoints');
    });
  });

  describe('GET /api/v2/ownerships/:id', () => {
    it('should return ownership details', async () => {
      const response = await request(app)
        .get(`/api/v2/ownerships/${testOwnership.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        id: testOwnership.id,
        type: 'FIXED_WEEK',
        fixed_week_number: 25,
        status: 'ACTIVE',
      });
      expect(response.body.data.unit).toBeDefined();
      expect(response.body.data.allocations).toBeInstanceOf(Array);
    });

    it('should return 404 for non-existent ownership', async () => {
      const response = await request(app)
        .get('/api/v2/ownerships/99999')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 when accessing another user\'s ownership', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'hashedpassword',
        firstName: 'Other',
        lastName: 'User',
        role_id: testUser.role_id,
        status: 'approved',
      });

      const otherToken = jwt.sign(
        { id: otherUser.id, email: otherUser.email, role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get(`/api/v2/ownerships/${testOwnership.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should allow admin to access any ownership', async () => {
      const response = await request(app)
        .get(`/api/v2/ownerships/${testOwnership.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('GET /api/v2/ownerships/my-ownerships', () => {
    it('should return user\'s ownerships', async () => {
      const response = await request(app)
        .get('/api/v2/ownerships/my-ownerships')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(1);
      expect(response.body.meta.count).toBeGreaterThanOrEqual(1);
    });

    it('should filter by activeOnly', async () => {
      // Create terminated ownership
      await Ownership.create({
        owner_id: testUser.id,
        unit_id: testUnit.id,
        type: 'FIXED_WEEK',
        fixed_week_number: 30,
        contract_start_year: 2026,
        annual_fee: 500,
        status: 'TERMINATED',
      });

      const response = await request(app)
        .get('/api/v2/ownerships/my-ownerships?activeOnly=true')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every((o: any) => o.status === 'ACTIVE')).toBe(true);
    });

    it('should return empty array for user without ownerships', async () => {
      const newUser = await User.create({
        email: 'newowner@test.com',
        password: 'hashedpassword',
        firstName: 'New',
        lastName: 'Owner',
        role_id: testUser.role_id,
        status: 'approved',
      });

      const newToken = jwt.sign(
        { id: newUser.id, email: newUser.email, role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v2/ownerships/my-ownerships')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.count).toBe(0);
    });
  });

  describe('POST /api/v2/ownerships/:id/transfer', () => {
    it('should transfer ownership (admin only)', async () => {
      // Create new owner
      const newOwner = await User.create({
        email: 'newowner2@test.com',
        password: 'hashedpassword',
        firstName: 'New',
        lastName: 'Owner2',
        role_id: testUser.role_id,
        status: 'approved',
      });

      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          newOwnerId: newOwner.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('transferred');

      // Verify ownership was updated
      const updated = await Ownership.findByPk(testOwnership.id);
      expect(updated?.owner_id).toBe(newOwner.id);
    });

    it('should return 403 for non-admin user', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/transfer`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          newOwnerId: adminUser.id,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should validate newOwnerId is provided', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v2/ownerships/:id/terminate', () => {
    it('should terminate ownership (admin only)', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/terminate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Contract ended',
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('terminated');

      // Verify ownership was terminated
      const updated = await Ownership.findByPk(testOwnership.id);
      expect(updated?.status).toBe('TERMINATED');
    });

    it('should return 403 for non-admin user', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/terminate`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reason: 'Test',
        })
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should use default reason if not provided', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/terminate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
