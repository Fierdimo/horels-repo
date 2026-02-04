/**
 * WeekReleaseController Integration Tests (Phase 3.5)
 * 
 * Tests HTTP endpoints for week release operations.
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
import CreditAccount from '../../../../src/models/v2/CreditAccount';
import CreditTransaction from '../../../../src/models/v2/CreditTransaction';
import jwt from 'jsonwebtoken';

describe('WeekReleaseController Integration Tests', () => {
  let testUser: User;
  let testProperty: TimeshareProperty;
  let testUnit: TimeshareUnit;
  let testOwnership: Ownership;
  let testWeek: WeekAllocation;
  let authToken: string;

  beforeAll(async () => {
    // Ensure database connection
    await sequelize.authenticate();
    // Initialize V2 models
    initV2Models(sequelize);
  });

  beforeEach(async () => {
    // Clean up V2 tables
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await CreditTransaction.destroy({ where: {}, truncate: true, force: true });
    await CreditAccount.destroy({ where: {}, truncate: true, force: true });
    await WeekAllocation.destroy({ where: {}, truncate: true, force: true });
    await Ownership.destroy({ where: {}, truncate: true, force: true });
    await TimeshareUnit.destroy({ where: {}, truncate: true, force: true });
    await TimeshareProperty.destroy({ where: {}, truncate: true, force: true });
    await User.destroy({ where: {}, truncate: true, force: true });
    await Role.destroy({ where: {}, truncate: true, force: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create user role
    const userRole = await Role.create({
      name: 'user',
      description: 'Regular user',
    });

    // Create test user
    testUser = await User.create({
      email: 'owner@test.com',
      password: 'hashedpassword',
      firstName: 'Test',
      lastName: 'Owner',
      role_id: userRole.id,
      status: 'approved',
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email, role: 'user' },
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
      amenities: ['pool', 'wifi'],
      images: ['image1.jpg'],
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
      size_sqm: 80,
      view_type: 'OCEAN',
      quantity: 10,
      base_credit_value: 1000,
      seasonal_factors: {
        summer: 1.2,
        winter: 0.8,
      },
      currency: 'EUR',
      amenities: ['kitchen', 'balcony'],
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

    // Create test week allocation
    testWeek = await WeekAllocation.create({
      ownership_id: testOwnership.id,
      year: 2026,
      week_number: 25,
      start_date: new Date('2026-06-15'),
      end_date: new Date('2026-06-22'),
      status: 'ASSIGNED',
    });

    // Create credit account
    await CreditAccount.create({
      user_id: testUser.id,
      balance: 0,
      currency: 'EUR',
      expiration_policy: '2_YEARS',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('POST /api/v2/weeks/release', () => {
    it('should release a week and award credits', async () => {
      const response = await request(app)
        .post('/api/v2/weeks/release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocationId: testWeek.id,
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        allocationId: testWeek.id,
        previousStatus: 'ASSIGNED',
        newStatus: 'RELEASED',
      });
      expect(response.body.data.credits.creditsIssued).toBeGreaterThan(0);
      expect(response.body.data.newBalance).toBeGreaterThan(0);

      // Verify week status changed
      const updatedWeek = await WeekAllocation.findByPk(testWeek.id);
      expect(updatedWeek?.status).toBe('RELEASED');

      // Verify credit transaction created
      const transaction = await CreditTransaction.findOne({
        where: { reference_id: testWeek.id },
      });
      expect(transaction).toBeTruthy();
      expect(transaction?.type).toBe('WEEK_RELEASE');
    });

    it('should return 404 for non-existent week', async () => {
      const response = await request(app)
        .post('/api/v2/weeks/release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocationId: 99999,
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should return 403 when releasing another user\'s week', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'hashedpassword',
        firstName: 'Other',
        lastName: 'User',
        role_id: testUser.role_id,
        status: 'approved',
      });

      // Create ownership for other user
      const otherOwnership = await Ownership.create({
        owner_id: otherUser.id,
        unit_id: testUnit.id,
        type: 'FIXED_WEEK',
        fixed_week_number: 26,
        contract_start_year: 2026,
        annual_fee: 500,
        status: 'ACTIVE',
      });

      // Create week for other user
      const otherWeek = await WeekAllocation.create({
        ownership_id: otherOwnership.id,
        year: 2026,
        week_number: 26,
        start_date: new Date('2026-06-22'),
        end_date: new Date('2026-06-29'),
        status: 'ASSIGNED',
      });

      const response = await request(app)
        .post('/api/v2/weeks/release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocationId: otherWeek.id,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('permission');
    });

    it('should return 400 for already released week', async () => {
      // Release the week first
      await WeekAllocation.update(
        { status: 'RELEASED', released_at: new Date() },
        { where: { id: testWeek.id } }
      );

      const response = await request(app)
        .post('/api/v2/weeks/release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          allocationId: testWeek.id,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('status');
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .post('/api/v2/weeks/release')
        .send({
          allocationId: testWeek.id,
        })
        .expect(401);
    });
  });

  describe('GET /api/v2/weeks/my-weeks', () => {
    beforeEach(async () => {
      // Create additional weeks for testing
      await WeekAllocation.create({
        ownership_id: testOwnership.id,
        year: 2026,
        week_number: 26,
        start_date: new Date('2026-06-22'),
        end_date: new Date('2026-06-29'),
        status: 'RELEASED',
      });

      await WeekAllocation.create({
        ownership_id: testOwnership.id,
        year: 2027,
        week_number: 25,
        start_date: new Date('2027-06-21'),
        end_date: new Date('2027-06-28'),
        status: 'ASSIGNED',
      });
    });

    it('should return user\'s weeks', async () => {
      const response = await request(app)
        .get('/api/v2/weeks/my-weeks')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThanOrEqual(3);
    });

    it('should filter by year', async () => {
      const response = await request(app)
        .get('/api/v2/weeks/my-weeks?year=2026')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.every((w: any) => w.year === 2026)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(app)
        .get('/api/v2/weeks/my-weeks?status=ASSIGNED')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.every((w: any) => w.status === 'ASSIGNED')).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v2/weeks/my-weeks?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeLessThanOrEqual(2);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(2);
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get('/api/v2/weeks/my-weeks')
        .expect(401);
    });
  });

  describe('POST /api/v2/weeks/:id/preview-release', () => {
    it('should preview credit calculation', async () => {
      const response = await request(app)
        .post(`/api/v2/weeks/${testWeek.id}/preview-release`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        allocationId: testWeek.id,
        weekNumber: 25,
        year: 2026,
      });
      expect(response.body.data.creditPreview).toBeDefined();
      expect(response.body.data.creditPreview.baseValue).toBe(1000);
      expect(response.body.data.creditPreview.finalCredits).toBeGreaterThan(0);
    });

    it('should return 404 for non-existent week', async () => {
      const response = await request(app)
        .post('/api/v2/weeks/99999/preview-release')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });

    it('should return 403 for another user\'s week', async () => {
      // Create another user's week
      const otherUser = await User.create({
        email: 'other2@test.com',
        password: 'hashedpassword',
        firstName: 'Other',
        lastName: 'User2',
        role_id: testUser.role_id,
        status: 'approved',
      });

      const otherOwnership = await Ownership.create({
        owner_id: otherUser.id,
        unit_id: testUnit.id,
        type: 'FIXED_WEEK',
        fixed_week_number: 27,
        contract_start_year: 2026,
        annual_fee: 500,
        status: 'ACTIVE',
      });

      const otherWeek = await WeekAllocation.create({
        ownership_id: otherOwnership.id,
        year: 2026,
        week_number: 27,
        start_date: new Date('2026-06-29'),
        end_date: new Date('2026-07-06'),
        status: 'ASSIGNED',
      });

      const response = await request(app)
        .post(`/api/v2/weeks/${otherWeek.id}/preview-release`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });
  });
});
