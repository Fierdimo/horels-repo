import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { Sequelize } from 'sequelize';

// Mock the services before importing app
vi.mock('../src/services/pmsService', () => {
  const mockPMSService = vi.fn();
  mockPMSService.prototype = {
    getAvailability: vi.fn(),
    createBooking: vi.fn(),
    getBooking: vi.fn(),
    updateBooking: vi.fn(),
    cancelBooking: vi.fn(),
    getProperty: vi.fn(),
    getUserProperties: vi.fn(),
  };
  return { default: mockPMSService };
});

vi.mock('../src/services/stripeService', () => {
  const mockStripeService = vi.fn();
  mockStripeService.prototype = {
    createPaymentIntent: vi.fn(),
    confirmPayment: vi.fn(),
    createRefund: vi.fn(),
    cancelPayment: vi.fn(),
    constructEvent: vi.fn(),
  };
  return { default: mockStripeService };
});

import app from '../src/app';
import { User, Role, ActionLog } from '../src/models';
import { setupTestDatabase } from './testHelpers';

describe('Client Routes', () => {
  let adminUser: User;
  let adminToken: string;
  let guestUser: User;
  let guestToken: string;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();

    // Create roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'admin' } });
    const [guestRole] = await Role.findOrCreate({ where: { name: 'guest' } });

    // Create test users with hashed passwords
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    
    [adminUser] = await User.findOrCreate({
      where: { email: 'admin@test.com' },
      defaults: {
        email: 'admin@test.com',
        password: hashedPassword,
        role_id: adminRole.id
      }
    });

    [guestUser] = await User.findOrCreate({
      where: { email: 'guest@test.com' },
      defaults: {
        email: 'guest@test.com',
        password: hashedPassword,
        role_id: guestRole.id
      }
    });

    // Generate tokens by logging in
    const loginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'admin@test.com',
        password: 'Password123!'
      });
    adminToken = loginResponse.body.token;

    const guestLoginResponse = await request(app)
      .post('/auth/login')
      .send({
        email: 'guest@test.com',
        password: 'Password123!'
      });
    guestToken = guestLoginResponse.body.token;
  });

  afterAll(async () => {
    // Note: Don't close sequelize connection as it's shared across tests
  });

  describe('GET /api/health', () => {
    it('should return health status without authentication', async () => {
      const response = await request(app)
        .get('/api/health')
        .expect(200);

      expect(response.body).toHaveProperty('status', 'ok');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('version');
    });
  });

  describe('GET /api/dashboard', () => {
    it('should return dashboard data for authenticated user', async () => {
      // Create some test activity logs
      await ActionLog.create({
        user_id: adminUser.id,
        action: 'user_login',
        details: { ip: '127.0.0.1' }
      } as any);

      const response = await request(app)
        .get('/api/dashboard')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id', adminUser.id);
      expect(response.body.user).toHaveProperty('email', adminUser.email);
      expect(response.body.user).toHaveProperty('role', 'admin');
      expect(response.body).toHaveProperty('recentActivity');
      expect(response.body).toHaveProperty('stats');
      expect(Array.isArray(response.body.recentActivity)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/dashboard')
        .expect(401);
    });
  });

  describe('GET /api/profile', () => {
    it('should return user profile for authenticated user', async () => {
      const response = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${guestToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('profile');
      expect(response.body.profile).toHaveProperty('id', guestUser.id);
      expect(response.body.profile).toHaveProperty('email', guestUser.email);
      expect(response.body.profile).toHaveProperty('role', 'guest');
      expect(response.body.profile).toHaveProperty('memberSince');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/api/profile')
        .expect(401);
    });
  });

  describe('PUT /api/settings', () => {
    it('should update user settings', async () => {
      const settings = {
        notifications: true,
        language: 'en',
        theme: 'dark'
      };

      const response = await request(app)
        .put('/api/settings')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(settings)
        .expect(200);

      expect(response.body).toHaveProperty('message', 'Settings updated successfully');
      expect(response.body).toHaveProperty('settings', settings);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .put('/api/settings')
        .send({ notifications: true })
        .expect(401);
    });
  });
});