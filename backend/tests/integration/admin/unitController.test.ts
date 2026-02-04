/**
 * UnitController Tests
 * Phase 7: Admin Tools
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import app from '../../../src/app';
import sequelizeConnection from '../../../src/config/database';
import { initV2Models } from '../../../src/models/v2';
import TimeshareUnit from '../../../src/models/v2/TimeshareUnit';
import TimeshareProperty from '../../../src/models/v2/TimeshareProperty';
import { User, Role } from '../../../src/models';
import jwt from 'jsonwebtoken';

describe('UnitController', () => {
  let adminToken: string;
  let staffToken: string;
  let ownerToken: string;
  let testProperty: any;
  let testProperty2: any;
  let testUnit: any;
  let adminUser: any;
  let staffUser: any;
  let ownerUser: any;

  beforeAll(async () => {
    // Ensure database connection
    await sequelizeConnection.authenticate();
    // Initialize V2 models
    initV2Models(sequelizeConnection);
  });

  beforeEach(async () => {
    // Clean up tables
    await sequelizeConnection.query('SET FOREIGN_KEY_CHECKS = 0');
    await TimeshareUnit.destroy({ where: {}, truncate: true, force: true });
    await TimeshareProperty.destroy({ where: {}, truncate: true, force: true });
    await User.destroy({ where: {}, truncate: true, force: true });
    await Role.destroy({ where: {}, truncate: true, force: true });
    await sequelizeConnection.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create roles
    await Role.bulkCreate([
      { id: 1, name: 'Admin', description: 'Administrator' },
      { id: 2, name: 'Staff', description: 'Staff' },
      { id: 3, name: 'Owner', description: 'Owner' }
    ]);

    // Create test properties
    testProperty = await TimeshareProperty.create({
      name: 'Test Resort',
      slug: 'test-resort',
      city: 'Miami',
      country: 'USA',
      region: 'North America',
      program_type: 'FIXED_WEEK',
      weeks_per_year: 52
    });

    testProperty2 = await TimeshareProperty.create({
      name: 'Test Resort 2',
      slug: 'test-resort-2',
      city: 'Barcelona',
      country: 'Spain',
      region: 'Europe',
      program_type: 'FLOATING',
      weeks_per_year: 52
    });

    // Create test users
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'password123',
      role_id: 1,
      first_name: 'Admin',
      last_name: 'User'
    });

    staffUser = await User.create({
      email: 'staff@test.com',
      password: 'password123',
      role_id: 2,
      first_name: 'Staff',
      last_name: 'User',
      property_id: testProperty.id
    });

    ownerUser = await User.create({
      email: 'owner@test.com',
      password: 'password123',
      role_id: 3,
      first_name: 'Owner',
      last_name: 'User'
    });

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'test-secret';
    adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role_id: adminUser.role_id }, jwtSecret);
    staffToken = jwt.sign({ id: staffUser.id, email: staffUser.email, role_id: staffUser.role_id, property_id: staffUser.property_id }, jwtSecret);
    ownerToken = jwt.sign({ id: ownerUser.id, email: ownerUser.email, role_id: ownerUser.role_id }, jwtSecret);

    // Create test unit
    testUnit = await TimeshareUnit.create({
      property_id: testProperty.id,
      category: '2-Bedroom Ocean View',
      slug: 'test-resort-2-bedroom-ocean-view',
      capacity_min: 4,
      capacity_max: 6,
      quantity: 10,
      bedrooms: 2,
      bathrooms: 2.0,
      size_sqm: 80,
      base_credit_value: 1000,
      currency: 'EUR',
      view_type: 'OCEAN',
      is_active: true
    });
  });

  afterAll(async () => {
    await sequelizeConnection.close();
  });

  describe('GET /api/admin/units', () => {
    it('should return all units for admin', async () => {
      const response = await request(app)
        .get('/api/admin/units')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      expect(response.body.meta).toBeDefined();
      expect(response.body.meta.total).toBeGreaterThan(0);
    });

    it('should return only property units for staff', async () => {
      // Create unit in staff's property
      await TimeshareUnit.create({
        property_id: testProperty.id,
        category: '1-Bedroom Garden View',
        slug: 'test-resort-1-bedroom-garden-view',
        capacity_max: 4,
        quantity: 5,
        bedrooms: 1,
        bathrooms: 1.0,
        base_credit_value: 600,
        currency: 'EUR',
        view_type: 'GARDEN',
        is_active: true
      });

      // Create unit in other property
      await TimeshareUnit.create({
        property_id: testProperty2.id,
        category: '2-Bedroom City View',
        slug: 'test-resort-2-2-bedroom-city-view',
        capacity_max: 6,
        quantity: 8,
        bedrooms: 2,
        bathrooms: 2.0,
        base_credit_value: 900,
        currency: 'EUR',
        view_type: 'CITY',
        is_active: true
      });

      const response = await request(app)
        .get('/api/admin/units')
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Staff should only see units from their property
      const propertyIds = response.body.data.map((u: any) => u.property_id);
      const allFromStaffProperty = propertyIds.every((id: number) => id === testProperty.id);
      expect(allFromStaffProperty).toBe(true);
    });

    it('should filter by property_id', async () => {
      const response = await request(app)
        .get(`/api/admin/units?property_id=${testProperty.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const allFromProperty = response.body.data.every((u: any) => u.property_id === testProperty.id);
      expect(allFromProperty).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(app)
        .get('/api/admin/units?category=Ocean')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const allHaveOcean = response.body.data.every((u: any) => u.category.includes('Ocean'));
      expect(allHaveOcean).toBe(true);
    });

    it('should filter by is_active', async () => {
      await TimeshareUnit.create({
        property_id: testProperty.id,
        category: 'Inactive Unit',
        slug: 'test-resort-inactive-unit',
        capacity_max: 4,
        quantity: 1,
        bedrooms: 1,
        bathrooms: 1.0,
        base_credit_value: 500,
        currency: 'EUR',
        is_active: false
      });

      const response = await request(app)
        .get('/api/admin/units?is_active=false')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const allInactive = response.body.data.every((u: any) => !u.is_active);
      expect(allInactive).toBe(true);
    });

    it('should support pagination', async () => {
      // Create multiple units
      for (let i = 0; i < 15; i++) {
        await TimeshareUnit.create({
          property_id: testProperty.id,
          category: `Test Unit ${i}`,
          slug: `test-resort-test-unit-${i}`,
          capacity_max: 4,
          quantity: 1,
          bedrooms: 1,
          bathrooms: 1.0,
          base_credit_value: 500,
          currency: 'EUR',
          is_active: true
        });
      }

      const response = await request(app)
        .get('/api/admin/units?page=1&limit=10')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBeLessThanOrEqual(10);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
      expect(response.body.meta.totalPages).toBeGreaterThan(1);
    });

    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/admin/units');

      expect(response.status).toBe(401);
    });

    it('should deny access to owner role', async () => {
      const response = await request(app)
        .get('/api/admin/units')
        .set('Authorization', `Bearer ${ownerToken}`);

      expect(response.status).toBe(403);
    });
  });

  describe('GET /api/admin/units/:id', () => {
    it('should return unit by ID for admin', async () => {
      const response = await request(app)
        .get(`/api/admin/units/${testUnit.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(testUnit.id);
      expect(response.body.data.category).toBe('2-Bedroom Ocean View');
    });

    it('should return 404 for non-existent unit', async () => {
      const response = await request(app)
        .get('/api/admin/units/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should deny staff access to units from other properties', async () => {
      const otherUnit = await TimeshareUnit.create({
        property_id: testProperty2.id,
        category: 'Other Property Unit',
        slug: 'test-resort-2-other-property-unit',
        capacity_max: 4,
        quantity: 1,
        bedrooms: 1,
        bathrooms: 1.0,
        base_credit_value: 500,
        currency: 'EUR',
        is_active: true
      });

      const response = await request(app)
        .get(`/api/admin/units/${otherUnit.id}`)
        .set('Authorization', `Bearer ${staffToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/units', () => {
    it('should create a new unit for admin', async () => {
      const unitData = {
        property_id: testProperty.id,
        category: '3-Bedroom Penthouse',
        capacity_max: 8,
        quantity: 2,
        bedrooms: 3,
        bathrooms: 3.0,
        size_sqm: 120,
        base_credit_value: 1500,
        view_type: 'OCEAN',
        amenities: ['Balcony', 'Jacuzzi'],
        description: 'Luxury penthouse'
      };

      const response = await request(app)
        .post('/api/admin/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(unitData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('3-Bedroom Penthouse');
      expect(response.body.data.slug).toBe('test-resort-3-bedroom-penthouse');
    });

    it('should allow staff to create units for their property', async () => {
      const unitData = {
        property_id: testProperty.id,
        category: 'Staff Created Unit',
        capacity_max: 4,
        quantity: 3,
        bedrooms: 1,
        bathrooms: 1.0,
        base_credit_value: 700
      };

      const response = await request(app)
        .post('/api/admin/units')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(unitData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
    });

    it('should deny staff creating units for other properties', async () => {
      const unitData = {
        property_id: testProperty2.id,
        category: 'Unauthorized Unit',
        capacity_max: 4,
        quantity: 1,
        bedrooms: 1,
        bathrooms: 1.0,
        base_credit_value: 500
      };

      const response = await request(app)
        .post('/api/admin/units')
        .set('Authorization', `Bearer ${staffToken}`)
        .send(unitData);

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/admin/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ category: 'Incomplete Unit' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should return 404 for non-existent property', async () => {
      const unitData = {
        property_id: 99999,
        category: 'Invalid Property Unit',
        capacity_max: 4,
        quantity: 1,
        bedrooms: 1,
        bathrooms: 1.0,
        base_credit_value: 500
      };

      const response = await request(app)
        .post('/api/admin/units')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(unitData);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/admin/units/:id', () => {
    it('should update unit for admin', async () => {
      const updates = {
        category: 'Updated Category',
        base_credit_value: 1200
      };

      const response = await request(app)
        .put(`/api/admin/units/${testUnit.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.category).toBe('Updated Category');
      expect(response.body.data.base_credit_value).toBe(1200);
    });

    it('should allow staff to update units in their property', async () => {
      const updates = {
        quantity: 12
      };

      const response = await request(app)
        .put(`/api/admin/units/${testUnit.id}`)
        .set('Authorization', `Bearer ${staffToken}`)
        .send(updates);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.quantity).toBe(12);
    });

    it('should return 404 for non-existent unit', async () => {
      const response = await request(app)
        .put('/api/admin/units/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 5 });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('DELETE /api/admin/units/:id', () => {
    it('should soft delete unit for admin', async () => {
      const unitToDelete = await TimeshareUnit.create({
        property_id: testProperty.id,
        category: 'To Delete',
        slug: 'test-resort-to-delete',
        capacity_max: 4,
        quantity: 1,
        bedrooms: 1,
        bathrooms: 1.0,
        base_credit_value: 500,
        currency: 'EUR',
        is_active: true
      });

      const response = await request(app)
        .delete(`/api/admin/units/${unitToDelete.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Verify soft delete
      const deletedUnit = await TimeshareUnit.findByPk(unitToDelete.id);
      expect(deletedUnit?.is_active).toBe(false);
    });

    it('should return 404 for non-existent unit', async () => {
      const response = await request(app)
        .delete('/api/admin/units/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/admin/units/bulk', () => {
    it('should bulk create units for admin', async () => {
      const unitsData = {
        units: [
          {
            property_id: testProperty.id,
            category: 'Bulk Unit 1',
            capacity_max: 4,
            quantity: 2,
            bedrooms: 1,
            bathrooms: 1.0,
            base_credit_value: 600
          },
          {
            property_id: testProperty.id,
            category: 'Bulk Unit 2',
            capacity_max: 6,
            quantity: 3,
            bedrooms: 2,
            bathrooms: 2.0,
            base_credit_value: 900
          }
        ]
      };

      const response = await request(app)
        .post('/api/admin/units/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(unitsData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.created.length).toBe(2);
      expect(response.body.data.failed.length).toBe(0);
    });

    it('should handle mixed success/failure', async () => {
      const unitsData = {
        units: [
          {
            property_id: testProperty.id,
            category: 'Valid Unit',
            capacity_max: 4,
            quantity: 1,
            bedrooms: 1,
            bathrooms: 1.0,
            base_credit_value: 500
          },
          {
            property_id: 99999, // Invalid property
            category: 'Invalid Unit',
            capacity_max: 4,
            quantity: 1,
            bedrooms: 1,
            bathrooms: 1.0,
            base_credit_value: 500
          }
        ]
      };

      const response = await request(app)
        .post('/api/admin/units/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(unitsData);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data.created.length).toBe(1);
      expect(response.body.data.failed.length).toBe(1);
    });

    it('should validate units array', async () => {
      const response = await request(app)
        .post('/api/admin/units/bulk')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ units: 'not-an-array' });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
