/**
 * WeekReleaseController Integration Tests
 * 
 * Tests HTTP endpoints for week release operations.
 * Uses supertest for HTTP assertions.
 */

import request from 'supertest';
import { Express } from 'express';
import { Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/testDatabaseSetup';
import User from '../../../src/models/User';
import TimeshareProperty from '../../../src/models/v2/TimeshareProperty';
import TimeshareUnit from '../../../src/models/v2/TimeshareUnit';
import Ownership from '../../../src/models/v2/Ownership';
import WeekAllocation from '../../../src/models/v2/WeekAllocation';
import CreditAccount from '../../../src/models/v2/CreditAccount';
import CreditTransaction from '../../../src/models/v2/CreditTransaction';

// Import app (we'll need to mock it or use a test instance)
let app: Express;
let sequelize: Sequelize;

// Test data
let testUser: User;
let testProperty: TimeshareProperty;
let testUnit: TimeshareUnit;
let testOwnership: Ownership;
let testWeekAllocation: WeekAllocation;
let authToken: string;

describe('WeekReleaseController', () => {
  beforeAll(async () => {
    sequelize = await setupTestDatabase();
    
    // Create Express app instance for testing
    const express = require('express');
    app = express();
    app.use(express.json());
    
    // Import auth middleware
    const { authenticateToken } = require('../../../src/middleware/auth');
    
    // Import routes
    const weekReleaseRoutes = require('../../../src/routes/v2/weekReleaseRoutes').default;
    
    // Register routes
    app.use('/api/v2/weeks', authenticateToken, weekReleaseRoutes);
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  beforeEach(async () => {
    // Clean tables
    await CreditTransaction.destroy({ where: {}, force: true });
    await CreditAccount.destroy({ where: {}, force: true });
    await WeekAllocation.destroy({ where: {}, force: true });
    await Ownership.destroy({ where: {}, force: true });
    await TimeshareUnit.destroy({ where: {}, force: true });
    await TimeshareProperty.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create test user
    testUser = await User.create({
      email: 'owner@test.com',
      password: 'hashed_password',
      firstName: 'Test',
      lastName: 'Owner',
      role: 'owner',
    });

    // Generate JWT token
    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email, role: testUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create test property
    testProperty = await TimeshareProperty.create({
      name: 'Test Beach Resort',
      slug: 'test-beach-resort',
      location: 'Test Beach',
      address: '123 Test St',
      city: 'Test City',
      country: 'Test Country',
      latitude: 36.5,
      longitude: -4.9,
      description: 'Test property',
      pms_provider: 'mews',
      pms_property_id: 'test-pms-123',
      is_active: true,
    });

    // Create test unit
    testUnit = await TimeshareUnit.create({
      property_id: testProperty.id,
      name: 'Test 2BR Unit',
      slug: 'test-2br',
      category: '2BR',
      bedrooms: 2,
      bathrooms: 2,
      capacity: 4,
      size_sqm: 80,
      base_credit_value: 1000,
      seasonal_factors: { '1': 0.8, '25': 1.2, '52': 0.9 },
      currency: 'EUR',
      quantity: 10,
      is_active: true,
    });

    // Create test ownership
    testOwnership = await Ownership.create({
      owner_id: testUser.id,
      unit_id: testUnit.id,
      type: 'FIXED_WEEK',
      fixed_week_number: 25,
      annual_fee: 500,
      currency: 'EUR',
      contract_start_year: 2026,
      contract_end_year: 2036,
      status: 'ACTIVE',
    });

    // Create test week allocation (ASSIGNED)
    testWeekAllocation = await WeekAllocation.create({
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

  describe('POST /api/v2/weeks/release', () => {
    it('should release a week and award credits', async () => {
      const response = await request(app)
        .post('/api/v2/weeks/release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ allocationId: testWeekAllocation.id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.allocationId).toBe(testWeekAllocation.id);
      expect(response.body.data.newStatus).toBe('RELEASED');
      expect(response.body.data.credits.creditsIssued).toBeGreaterThan(0);
      expect(response.body.data.newBalance).toBeGreaterThan(0);

      // Verify week status updated
      const updatedWeek = await WeekAllocation.findByPk(testWeekAllocation.id);
      expect(updatedWeek?.status).toBe('RELEASED');

      // Verify credits awarded
      const account = await CreditAccount.findOne({ where: { user_id: testUser.id } });
      expect(account?.balance).toBeGreaterThan(0);

      // Verify transaction created
      const transaction = await CreditTransaction.findOne({
        where: {
          account_id: account!.id,
          type: 'WEEK_RELEASE',
        },
      });
      expect(transaction).toBeTruthy();
    });

    it('should reject release if week not owned by user', async () => {
      // Create another user
      const otherUser = await User.create({
        email: 'other@test.com',
        password: 'hashed_password',
        firstName: 'Other',
        lastName: 'User',
        role: 'owner',
      });

      const otherToken = jwt.sign(
        { id: otherUser.id, email: otherUser.email, role: otherUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .post('/api/v2/weeks/release')
        .set('Authorization', `Bearer ${otherToken}`)
        .send({ allocationId: testWeekAllocation.id })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not own');
    });

    it('should reject release if week already released', async () => {
      // Release week first time
      await request(app)
        .post('/api/v2/weeks/release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ allocationId: testWeekAllocation.id })
        .expect(200);

      // Try to release again
      const response = await request(app)
        .post('/api/v2/weeks/release')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ allocationId: testWeekAllocation.id })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('ASSIGNED');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/v2/weeks/release')
        .send({ allocationId: testWeekAllocation.id })
        .expect(401);
    });
  });

  describe('GET /api/v2/weeks/my-weeks', () => {
    it('should return user weeks with pagination', async () => {
      const response = await request(app)
        .get('/api/v2/weeks/my-weeks')
        .query({ year: 2026 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(testWeekAllocation.id);
      expect(response.body.meta.count).toBe(1);
    });

    it('should filter by status', async () => {
      // Create RELEASED week
      const releasedWeek = await WeekAllocation.create({
        ownership_id: testOwnership.id,
        year: 2026,
        week_number: 26,
        start_date: new Date('2026-06-22'),
        end_date: new Date('2026-06-29'),
        status: 'RELEASED',
        released_at: new Date(),
        credits_issued: 1080,
      });

      const response = await request(app)
        .get('/api/v2/weeks/my-weeks')
        .query({ year: 2026, status: 'RELEASED' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(releasedWeek.id);
    });

    it('should support pagination', async () => {
      // Create multiple weeks
      for (let i = 1; i <= 15; i++) {
        await WeekAllocation.create({
          ownership_id: testOwnership.id,
          year: 2026,
          week_number: null, // Bypass UNIQUE constraint
          start_date: new Date(2026, 0, i * 7),
          end_date: new Date(2026, 0, (i + 1) * 7),
          status: 'ASSIGNED',
        });
      }

      const response = await request(app)
        .get('/api/v2/weeks/my-weeks')
        .query({ year: 2026, page: 1, limit: 10 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(10);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
    });
  });

  describe('POST /api/v2/weeks/:id/preview-release', () => {
    it('should preview credit calculation without releasing', async () => {
      const response = await request(app)
        .post(`/api/v2/weeks/${testWeekAllocation.id}/preview-release`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.allocationId).toBe(testWeekAllocation.id);
      expect(response.body.data.credits.baseValue).toBe(1000);
      expect(response.body.data.credits.seasonalMultiplier).toBeDefined();
      expect(response.body.data.credits.finalCredits).toBeGreaterThan(0);

      // Verify week NOT released
      const week = await WeekAllocation.findByPk(testWeekAllocation.id);
      expect(week?.status).toBe('ASSIGNED'); // Should still be ASSIGNED

      // Verify no credits awarded
      const account = await CreditAccount.findOne({ where: { user_id: testUser.id } });
      expect(account?.balance).toBe(0);
    });

    it('should show timing decay based on release date', async () => {
      // Week is 2026-06-15, current date is 2026-02-01 (135 days advance)
      const response = await request(app)
        .post(`/api/v2/weeks/${testWeekAllocation.id}/preview-release`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      // 135 days = 90-180 range = 0.9 multiplier
      expect(response.body.data.credits.timingMultiplier).toBe(0.9);
    });
  });
});
