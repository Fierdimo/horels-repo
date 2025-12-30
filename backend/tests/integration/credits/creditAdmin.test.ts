import request from 'supertest';
import app from '../../../src/app';
import sequelize from '../../../src/config/database';
import { setupTestDatabase } from '../../testHelpers';
import User from '../../../src/models/User';
import Role from '../../../src/models/Role';
import Property from '../../../src/models/Property';
import PropertyTier from '../../../src/models/PropertyTier';
import RoomTypeMultiplier from '../../../src/models/RoomTypeMultiplier';
import SeasonalCalendar from '../../../src/models/SeasonalCalendar';
import CreditBookingCost from '../../../src/models/CreditBookingCost';
import PlatformSetting from '../../../src/models/PlatformSetting';
import SettingChangeLog from '../../../src/models/SettingChangeLog';

describe('Credit Admin API Integration Tests', () => {
  let adminUser: User;
  let testProperty: Property;
  let testTier: PropertyTier;
  let adminToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up test data using TRUNCATE (faster and handles FK constraints)
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await SettingChangeLog.destroy({ where: {}, truncate: true });
    await CreditBookingCost.destroy({ where: {}, truncate: true });
    await SeasonalCalendar.destroy({ where: {}, truncate: true });
    await RoomTypeMultiplier.destroy({ where: {}, truncate: true });
    await PropertyTier.destroy({ where: {}, truncate: true });
    await Property.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });
    await Role.destroy({ where: {}, truncate: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create admin role
    const adminRole = await Role.create({ name: 'admin', description: 'Administrator' });

    // Create admin user
    adminUser = await User.create({
      email: 'admin@test.com',
      password: 'hashedpassword',
      firstName: 'Admin',
      lastName: 'User',
      role_id: adminRole.id,
      status: 'approved'
    });

    adminToken = 'Bearer admin-token-' + adminUser.id;

    // Create property tier
    testTier = await PropertyTier.create({
      tier_code: 'DIAMOND',
      tier_name: 'Diamond Properties',
      location_multiplier: 1.5,
      display_order: 1
    });

    // Create test property
    testProperty = await Property.create({
      name: 'Admin Test Resort',
      address: '456 Admin St',
      city: 'Admin City',
      country: 'Test Country',
      location: 'Admin City, Test Country',
      tier: 'STANDARD',
      location_multiplier: 1.00
    });

    // Create room multipliers
    await RoomTypeMultiplier.create({
      room_type: 'STANDARD',
      multiplier: 1.0,
      is_active: true,
      display_order: 1
    });

    await RoomTypeMultiplier.create({
      room_type: 'DELUXE',
      multiplier: 1.5,
      is_active: true,
      display_order: 2
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/credits/admin/tiers', () => {
    it('should return all property tiers', async () => {
      const response = await request(app)
        .get('/api/credits/admin/tiers')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const tier = response.body.data[0];
      expect(tier).toHaveProperty('id');
      expect(tier).toHaveProperty('code');
      expect(tier).toHaveProperty('name');
      expect(tier).toHaveProperty('multiplier');
    });
  });

  describe('PUT /api/credits/admin/tiers/:id', () => {
    it('should update property tier multiplier', async () => {
      const response = await request(app)
        .put(`/api/credits/admin/tiers/${testTier.id}`)
        .set('Authorization', adminToken)
        .send({
          multiplier: 1.6
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.multiplier).toBe(1.6);

      // Verify in database
      const updated = await PropertyTier.findByPk(testTier.id);
      expect(Number(updated?.location_multiplier)).toBe(1.6);
    });

    it('should log the change in audit log', async () => {
      await request(app)
        .put(`/api/credits/admin/tiers/${testTier.id}`)
        .set('Authorization', adminToken)
        .send({
          multiplier: 1.7
        });

      const logs = await SettingChangeLog.findAll({
        where: { setting_key: `tier_multiplier_${testTier.tier_code}` }
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].new_value).toBe('1.7');
      expect(logs[0].changed_by).toBe(adminUser.id);
    });

    it('should return 404 for non-existent tier', async () => {
      const response = await request(app)
        .put('/api/credits/admin/tiers/99999')
        .set('Authorization', adminToken)
        .send({
          multiplier: 1.5
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });

    it('should return 400 if multiplier missing', async () => {
      const response = await request(app)
        .put(`/api/credits/admin/tiers/${testTier.id}`)
        .set('Authorization', adminToken)
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/credits/admin/properties/:id/tier', () => {
    it('should assign tier to property', async () => {
      const response = await request(app)
        .put(`/api/credits/admin/properties/${testProperty.id}/tier`)
        .set('Authorization', adminToken)
        .send({
          tierId: testTier.id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.propertyId).toBe(testProperty.id);
      expect(response.body.data.tierId).toBe(testTier.id);

      // Verify in database
      const updated = await Property.findByPk(testProperty.id);
      expect(updated?.tier_id).toBe(testTier.id);
    });

    it('should return 404 for non-existent property', async () => {
      const response = await request(app)
        .put('/api/credits/admin/properties/99999/tier')
        .set('Authorization', adminToken)
        .send({
          tierId: testTier.id
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/credits/admin/room-multipliers', () => {
    it('should return all room multipliers', async () => {
      const response = await request(app)
        .get('/api/credits/admin/room-multipliers')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
      
      const multiplier = response.body.data[0];
      expect(multiplier).toHaveProperty('roomType');
      expect(multiplier).toHaveProperty('multiplier');
      expect(multiplier).toHaveProperty('isActive');
    });
  });

  describe('PUT /api/credits/admin/room-multipliers/:id', () => {
    it('should update room multiplier', async () => {
      const roomMultiplier = await RoomTypeMultiplier.findOne({
        where: { room_type: 'DELUXE' }
      });

      const response = await request(app)
        .put(`/api/credits/admin/room-multipliers/${roomMultiplier!.id}`)
        .set('Authorization', adminToken)
        .send({
          multiplier: 1.6
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.multiplier).toBe(1.6);

      // Verify in database
      const updated = await RoomTypeMultiplier.findByPk(roomMultiplier!.id);
      expect(Number(updated?.multiplier)).toBe(1.6);
    });

    it('should log the change', async () => {
      const roomMultiplier = await RoomTypeMultiplier.findOne({
        where: { room_type: 'STANDARD' }
      });

      await request(app)
        .put(`/api/credits/admin/room-multipliers/${roomMultiplier!.id}`)
        .set('Authorization', adminToken)
        .send({
          multiplier: 1.1
        });

      const logs = await SettingChangeLog.findAll({
        where: { setting_key: 'room_multiplier_STANDARD' }
      });

      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/credits/admin/seasonal-calendar/:propertyId/:year', () => {
    beforeEach(async () => {
      // Create seasonal calendar entries
      await SeasonalCalendar.create({
        property_id: testProperty.id,
        season_type: 'RED',
        start_date: new Date('2025-07-01'),
        end_date: new Date('2025-08-31'),
        year: 2025
      });

      await SeasonalCalendar.create({
        property_id: testProperty.id,
        season_type: 'WHITE',
        start_date: new Date('2025-05-01'),
        end_date: new Date('2025-06-30'),
        year: 2025
      });
    });

    it('should return seasonal calendar for property and year', async () => {
      const response = await request(app)
        .get(`/api/credits/admin/seasonal-calendar/${testProperty.id}/2025`)
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBe(2);
      
      const season = response.body.data[0];
      expect(season).toHaveProperty('seasonType');
      expect(season).toHaveProperty('startDate');
      expect(season).toHaveProperty('endDate');
    });

    it('should return 400 for invalid propertyId', async () => {
      const response = await request(app)
        .get('/api/credits/admin/seasonal-calendar/invalid/2025')
        .set('Authorization', adminToken);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/credits/admin/seasonal-calendar', () => {
    it('should create seasonal calendar entry', async () => {
      const response = await request(app)
        .post('/api/credits/admin/seasonal-calendar')
        .set('Authorization', adminToken)
        .send({
          propertyId: testProperty.id,
          seasonType: 'BLUE',
          startDate: '2025-01-01',
          endDate: '2025-02-28',
          year: 2025
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.seasonType).toBe('BLUE');

      // Verify in database
      const created = await SeasonalCalendar.findOne({
        where: {
          property_id: testProperty.id,
          season_type: 'BLUE'
        }
      });
      expect(created).toBeDefined();
    });

    it('should return 400 if required fields missing', async () => {
      const response = await request(app)
        .post('/api/credits/admin/seasonal-calendar')
        .set('Authorization', adminToken)
        .send({
          propertyId: testProperty.id
          // missing other fields
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/credits/admin/booking-costs/:propertyId', () => {
    beforeEach(async () => {
      await CreditBookingCost.create({
        property_id: testProperty.id,
        room_type: 'DELUXE',
        season_type: 'RED',
        credits_per_night: 900,
        effective_from: new Date('2025-01-01'),
        is_active: true
      });
    });

    it('should return booking costs for property', async () => {
      const response = await request(app)
        .get(`/api/credits/admin/booking-costs/${testProperty.id}`)
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const cost = response.body.data[0];
      expect(cost).toHaveProperty('roomType');
      expect(cost).toHaveProperty('seasonType');
      expect(cost).toHaveProperty('creditsPerNight');
    });
  });

  describe('POST /api/credits/admin/booking-costs/:propertyId', () => {
    it('should update booking costs for property', async () => {
      const response = await request(app)
        .post(`/api/credits/admin/booking-costs/${testProperty.id}`)
        .set('Authorization', adminToken)
        .send({
          effectiveFrom: '2025-03-01',
          prices: [
            { roomType: 'STANDARD', seasonType: 'RED', creditsPerNight: 700 },
            { roomType: 'DELUXE', seasonType: 'RED', creditsPerNight: 1050 }
          ]
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.pricesUpdated).toBe(2);

      // Verify in database
      const costs = await CreditBookingCost.findAll({
        where: {
          property_id: testProperty.id,
          is_active: true
        }
      });
      expect(costs.length).toBe(2);
    });

    it('should return 400 if prices or effectiveFrom missing', async () => {
      const response = await request(app)
        .post(`/api/credits/admin/booking-costs/${testProperty.id}`)
        .set('Authorization', adminToken)
        .send({
          effectiveFrom: '2025-03-01'
          // prices missing
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/credits/admin/settings', () => {
    it('should return all platform settings', async () => {
      const response = await request(app)
        .get('/api/credits/admin/settings')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });
  });

  describe('PUT /api/credits/admin/settings/:key', () => {
    beforeEach(async () => {
      await PlatformSetting.findOrCreate({
        where: { setting_key: 'credit_to_euro_rate' },
        defaults: {
          setting_value: '1.00',
          data_type: 'DECIMAL',
          category: 'CONVERSION',
          description: 'Conversion rate',
          is_editable_by_admin: true
        }
      });
    });

    it('should update platform setting', async () => {
      const response = await request(app)
        .put('/api/credits/admin/settings/credit_to_euro_rate')
        .set('Authorization', adminToken)
        .send({
          value: '1.10',
          reason: 'Rate adjustment for 2025'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.value).toBe('1.10');

      // Verify in database
      const updated = await PlatformSetting.findOne({
        where: { setting_key: 'credit_to_euro_rate' }
      });
      expect(updated?.setting_value).toBe('1.10');
    });

    it('should log the change with reason', async () => {
      await request(app)
        .put('/api/credits/admin/settings/credit_to_euro_rate')
        .set('Authorization', adminToken)
        .send({
          value: '1.15',
          reason: 'Market adjustment'
        });

      const logs = await SettingChangeLog.findAll({
        where: { setting_key: 'credit_to_euro_rate' }
      });

      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].new_value).toBe('1.15');
      expect(logs[0].change_reason).toBe('Market adjustment');
    });

    it('should return 404 for non-existent setting', async () => {
      const response = await request(app)
        .put('/api/credits/admin/settings/nonexistent_key')
        .set('Authorization', adminToken)
        .send({
          value: '100'
        });

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/credits/admin/change-log', () => {
    beforeEach(async () => {
      await SettingChangeLog.create({
        setting_key: 'test_setting',
        old_value: '1.0',
        new_value: '2.0',
        changed_by: adminUser.id,
        change_reason: 'Test change'
      });
    });

    it('should return change log', async () => {
      const response = await request(app)
        .get('/api/credits/admin/change-log')
        .set('Authorization', adminToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
      
      const log = response.body.data[0];
      expect(log).toHaveProperty('settingKey');
      expect(log).toHaveProperty('oldValue');
      expect(log).toHaveProperty('newValue');
      expect(log).toHaveProperty('changedBy');
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/credits/admin/change-log')
        .set('Authorization', adminToken)
        .query({ limit: 5 });

      expect(response.status).toBe(200);
      expect(response.body.data.length).toBeLessThanOrEqual(5);
    });
  });
});
