import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../src/app';
import sequelize from '../src/config/database';
import User from '../src/models/User';
import Week from '../src/models/Week';
import Property from '../src/models/Property';
import SwapRequest from '../src/models/SwapRequest';
import NightCredit from '../src/models/NightCredit';
import Role from '../src/models/Role';
import Permission from '../src/models/Permission';
import RolePermission from '../src/models/RolePermission';
import bcrypt from 'bcryptjs';

import { setupTestDatabase } from './testHelpers';

describe('Timesharing API Integration', () => {
  let authToken: string;
  let ownerId: number;
  let weekId: number;
  let propertyId: string;
  const testId = Date.now().toString();

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    
    // Create owner role
    const [ownerRole] = await Role.findOrCreate({
      where: { name: 'owner' }
    });

    // Create timesharing permissions
    const permissions = [
      'view_own_weeks', 'confirm_week', 'create_swap', 'view_swaps',
      'convert_week', 'view_night_credits', 'use_night_credits'
    ];

    for (const permName of permissions) {
      const permission = await Permission.findOrCreate({
        where: { name: permName }
      });

      // Assign permission to owner role
      await RolePermission.findOrCreate({
        where: {
          role_id: ownerRole.id,
          permission_id: permission[0].id
        }
      });
    }

    // Create test property with unique ID
    const property = await Property.create({
      name: 'Test Hotel',
      location: 'Test City',
      latitude: 40.7128,
      longitude: -74.0060
    });
    propertyId = property.id;

    // Create test owner with hashed password and unique email
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const owner = await User.create({
      email: `owner-${testId}@test.com`,
      password: hashedPassword,
      role_id: ownerRole.id
    });
    ownerId = owner.id;

    // Create test week
    const week = await Week.create({
      owner_id: ownerId,
      property_id: propertyId,
      week_number: 1,
      year: 2025,
      start_date: new Date('2025-01-01'),
      end_date: new Date('2025-01-07'),
      color: 'red',
      status: 'available'
    });
    weekId = week.id;

    // Login to get auth token
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: `owner-${testId}@test.com`,
        password: 'Password123!'
      });

    expect(loginResponse.status).toBe(200);
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    // Note: Don't close sequelize connection as it's shared across tests
  });

  describe('Week Management', () => {
    it('should get user weeks', async () => {
      const response = await request(app)
        .get('/timeshare/weeks')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should confirm week usage', async () => {
      const response = await request(app)
        .post(`/timeshare/weeks/${weekId}/confirm`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('confirmed');
    });
  });

  describe('Swap Management', () => {
    let targetWeekId: number;

    beforeAll(async () => {
      // Create another owner and week for swapping
      const [targetOwnerRole] = await Role.findOrCreate({
        where: { name: 'owner' }
      });

      // Assign permissions to target owner role
      const permissions = await Permission.findAll({
        where: { name: ['view_own_weeks', 'create_swap', 'view_swaps'] }
      });

      for (const perm of permissions) {
        await RolePermission.findOrCreate({
          where: {
            role_id: targetOwnerRole.id,
            permission_id: perm.id
          }
        });
      }

      const hashedPassword = await bcrypt.hash('Password123!', 10);
      const targetOwner = await User.create({
        email: `target-owner-${testId}@test.com`,
        password: hashedPassword,
        role_id: targetOwnerRole.id
      });

      const targetWeek = await Week.create({
        owner_id: targetOwner.id,
        property_id: propertyId,
        week_number: 2,
        year: 2025,
        start_date: new Date('2025-01-08'),
        end_date: new Date('2025-01-14'),
        color: 'red', // Same color for valid swap
        status: 'available'
      });
      targetWeekId = targetWeek.id;
    });

    it('should create swap request', async () => {
      // Create a new available week for the owner to use in swap
      const swapWeek = await Week.create({
        owner_id: ownerId,
        property_id: propertyId,
        week_number: 4,
        year: 2025,
        start_date: new Date('2025-01-22'),
        end_date: new Date('2025-01-28'),
        color: 'red',
        status: 'available'
      });

      const response = await request(app)
        .post('/timeshare/swaps')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          weekId: swapWeek.id,
          desiredStartDate: '2025-01-08',
          desiredEndDate: '2025-01-14',
          notes: 'Test swap request'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.status).toBe('pending');

      // Clean up
      await Week.destroy({ where: { id: swapWeek.id } });
    });

    it('should get user swap requests', async () => {
      const response = await request(app)
        .get('/timeshare/swaps')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('Night Credits', () => {
    it('should convert week to credits', async () => {
      // First create a new available week for conversion
      const convertWeek = await Week.create({
        owner_id: ownerId,
        property_id: propertyId,
        week_number: 3,
        year: 2025,
        start_date: new Date('2025-01-15'),
        end_date: new Date('2025-01-21'),
        color: 'red',
        status: 'available'
      });

      const response = await request(app)
        .post(`/timeshare/weeks/${convertWeek.id}/convert`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.nightCredit).toBeDefined();
      expect(response.body.data.nightCredit.total_nights).toBe(6); // Red week = 6 nights

      // Clean up
      await Week.destroy({ where: { id: convertWeek.id } });
    });

    it('should get user credits', async () => {
      const response = await request(app)
        .get('/timeshare/night-credits')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.credits).toBeDefined();
      expect(Array.isArray(response.body.data.credits)).toBe(true);
    });
  });

  describe('Error Handling', () => {
    it('should reject invalid token', async () => {
      const response = await request(app)
        .get('/timeshare/weeks')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
    });

    it('should reject unauthorized access', async () => {
      const response = await request(app)
        .get('/timeshare/weeks');

      expect(response.status).toBe(401);
    });
  });
});