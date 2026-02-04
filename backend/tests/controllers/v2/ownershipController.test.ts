/**
 * OwnershipController Integration Tests
 * 
 * Tests HTTP endpoints for ownership management (admin operations).
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

let app: Express;
let sequelize: Sequelize;
let adminUser: User;
let ownerUser: User;
let adminToken: string;
let ownerToken: string;
let testProperty: TimeshareProperty;
let testUnit: TimeshareUnit;
let testOwnership: Ownership;

describe('OwnershipController', () => {
  beforeAll(async () => {
    sequelize = await setupTestDatabase();
    
    // Create Express app
    const express = require('express');
    app = express();
    app.use(express.json());
    
    const { authenticateToken } = require('../../../src/middleware/auth');
    const ownershipRoutes = require('../../../src/routes/v2/ownershipRoutes').default;
    
    app.use('/api/v2/ownerships', authenticateToken, ownershipRoutes);
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  beforeEach(async () => {
    // Clean tables
    await WeekAllocation.destroy({ where: {}, force: true });
    await Ownership.destroy({ where: {}, force: true });
    await TimeshareUnit.destroy({ where: {}, force: true });
    await TimeshareProperty.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create admin user
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'hashed_password',
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
    });

    adminToken = jwt.sign(
      { id: adminUser.id, email: adminUser.email, role: adminUser.role },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create owner user
    ownerUser = await User.create({
      email: 'owner@test.com',
      password: 'hashed_password',
      firstName: 'Owner',
      lastName: 'User',
      role: 'owner',
    });

    ownerToken = jwt.sign(
      { id: ownerUser.id, email: ownerUser.email, role: ownerUser.role },
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
      owner_id: ownerUser.id,
      unit_id: testUnit.id,
      type: 'FIXED_WEEK',
      fixed_week_number: 25,
      annual_fee: 500,
      currency: 'EUR',
      contract_start_year: 2026,
      contract_end_year: 2036,
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

  describe('POST /api/v2/ownerships', () => {
    it('should create new ownership (admin only)', async () => {
      const response = await request(app)
        .post('/api/v2/ownerships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ownerId: ownerUser.id,
          unitId: testUnit.id,
          type: 'FLOATING',
          annualPoints: 1200,
          annualFee: 600,
          currency: 'EUR',
          contractStartYear: 2026,
          contractEndYear: 2036,
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.type).toBe('FLOATING');
      expect(response.body.data.annualPoints).toBe(1200);
      expect(response.body.data.status).toBe('ACTIVE');

      // Verify in database
      const ownership = await Ownership.findByPk(response.body.data.id);
      expect(ownership).toBeTruthy();
      expect(ownership?.type).toBe('FLOATING');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .post('/api/v2/ownerships')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({
          ownerId: ownerUser.id,
          unitId: testUnit.id,
          type: 'FIXED_WEEK',
          fixedWeekNumber: 30,
          annualFee: 500,
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Admin');
    });

    it('should validate FIXED_WEEK requires fixedWeekNumber', async () => {
      const response = await request(app)
        .post('/api/v2/ownerships')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ownerId: ownerUser.id,
          unitId: testUnit.id,
          type: 'FIXED_WEEK',
          // Missing fixedWeekNumber
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
          ownerId: ownerUser.id,
          unitId: testUnit.id,
          type: 'POINTS',
          // Missing annualPoints
          annualFee: 500,
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('annualPoints');
    });
  });

  describe('GET /api/v2/ownerships/:id', () => {
    it('should return ownership details for owner', async () => {
      const response = await request(app)
        .get(`/api/v2/ownerships/${testOwnership.id}`)
        .query({ year: 2026 })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testOwnership.id);
      expect(response.body.data.type).toBe('FIXED_WEEK');
      expect(response.body.data.fixedWeekNumber).toBe(25);
      expect(response.body.data.unit).toBeDefined();
      expect(response.body.data.allocations).toBeInstanceOf(Array);
      expect(response.body.data.allocations.length).toBe(1);
    });

    it('should return ownership details for admin', async () => {
      const response = await request(app)
        .get(`/api/v2/ownerships/${testOwnership.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testOwnership.id);
    });

    it('should reject non-owner and non-admin', async () => {
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
        .get(`/api/v2/ownerships/${testOwnership.id}`)
        .set('Authorization', `Bearer ${otherToken}`)
        .expect(403);

      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent ownership', async () => {
      const response = await request(app)
        .get('/api/v2/ownerships/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/v2/ownerships/my-ownerships', () => {
    it('should return user ownerships', async () => {
      const response = await request(app)
        .get('/api/v2/ownerships/my-ownerships')
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].id).toBe(testOwnership.id);
      expect(response.body.meta.count).toBe(1);
    });

    it('should filter active only', async () => {
      // Create terminated ownership
      await Ownership.create({
        owner_id: ownerUser.id,
        unit_id: testUnit.id,
        type: 'FLOATING',
        annual_fee: 500,
        currency: 'EUR',
        contract_start_year: 2020,
        contract_end_year: 2025,
        status: 'TERMINATED',
      });

      const response = await request(app)
        .get('/api/v2/ownerships/my-ownerships')
        .query({ activeOnly: true })
        .set('Authorization', `Bearer ${ownerToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].status).toBe('ACTIVE');
    });

    it('should return empty array for user with no ownerships', async () => {
      const newUser = await User.create({
        email: 'newowner@test.com',
        password: 'hashed_password',
        firstName: 'New',
        lastName: 'Owner',
        role: 'owner',
      });

      const newToken = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role },
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
    it('should transfer ownership to new owner (admin only)', async () => {
      const newOwner = await User.create({
        email: 'newowner@test.com',
        password: 'hashed_password',
        firstName: 'New',
        lastName: 'Owner',
        role: 'owner',
      });

      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newOwnerId: newOwner.id })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.newOwnerId).toBe(newOwner.id);

      // Verify in database
      const ownership = await Ownership.findByPk(testOwnership.id);
      expect(ownership?.owner_id).toBe(newOwner.id);
    });

    it('should reject non-admin users', async () => {
      const newOwner = await User.create({
        email: 'newowner@test.com',
        password: 'hashed_password',
        firstName: 'New',
        lastName: 'Owner',
        role: 'owner',
      });

      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/transfer`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ newOwnerId: newOwner.id })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Admin');
    });

    it('should validate newOwnerId', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/transfer`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // Missing newOwnerId
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('newOwnerId');
    });
  });

  describe('POST /api/v2/ownerships/:id/terminate', () => {
    it('should terminate ownership (admin only)', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/terminate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Contract expired' })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.message).toContain('terminated');

      // Verify in database
      const ownership = await Ownership.findByPk(testOwnership.id);
      expect(ownership?.status).toBe('TERMINATED');
    });

    it('should reject non-admin users', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/terminate`)
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ reason: 'Contract expired' })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Admin');
    });

    it('should use default reason if not provided', async () => {
      const response = await request(app)
        .post(`/api/v2/ownerships/${testOwnership.id}/terminate`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({}) // No reason
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
