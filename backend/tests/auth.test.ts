import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
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
import { Role, Permission, User, RolePermission, ActionLog } from '../src/models';
import { setupTestDatabase } from './testHelpers';

describe('Authentication', () => {
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    
    // Create roles
    const [adminRole] = await Role.findOrCreate({ where: { name: 'admin' } });
    const [guestRole] = await Role.findOrCreate({ where: { name: 'guest' } });

    // Create permissions
    const permissions = [
      'create_user', 'view_users', 'update_user', 'delete_user',
      'view_bookings', 'create_booking', 'update_booking',
      'manage_payments', 'view_reports', 'manage_roles', 'manage_permissions'
    ];

    for (const perm of permissions) {
      await Permission.findOrCreate({ where: { name: perm } });
    }

    // Assign all permissions to admin role (if not already assigned)
    const adminPerms = await Permission.findAll();
    for (const perm of adminPerms) {
      await RolePermission.findOrCreate({
        where: {
          role_id: adminRole.id,
          permission_id: perm.id
        }
      });
    }

    // Create test users with hashed passwords
    const hashedPassword = await bcrypt.hash('Password123!', 10);
    const [adminUser] = await User.findOrCreate({
      where: { email: 'admin@test.com' },
      defaults: {
        email: 'admin@test.com',
        password: hashedPassword,
        role_id: adminRole.id
      }
    });

    const [guestUser] = await User.findOrCreate({
      where: { email: 'guest@test.com' },
      defaults: {
        email: 'guest@test.com',
        password: hashedPassword,
        role_id: guestRole.id
      }
    });
  });

  afterAll(async () => {
    // Clean up database after all tests
    const sequelize = (await import('../src/config/database')).default;
    await sequelize.close();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      // Clean up any existing test user
      await User.destroy({ where: { email: 'newuser@test.com' } });

      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'newuser@test.com',
          password: 'Password123!',
          roleName: 'guest'
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User created successfully');
      expect(response.body).toHaveProperty('userId');
    });

    it('should return error for existing user', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'admin@test.com',
          password: 'password123',
          roleName: 'admin'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });

    it('should return error for invalid role', async () => {
      const response = await request(app)
        .post('/auth/register')
        .send({
          email: 'invalid@test.com',
          password: 'password123',
          roleName: 'invalid'
        });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('error', 'Validation failed');
    });
  });

  describe('POST /auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'admin@test.com');
      expect(response.body.user).toHaveProperty('role', 'admin');

      adminToken = response.body.token;
    });

    it('should return error for invalid credentials', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });

    it('should return error for non-existent user', async () => {
      const response = await request(app)
        .post('/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'Password123!'
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Invalid credentials');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info with valid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('email', 'admin@test.com');
      expect(response.body.user).toHaveProperty('role', 'admin');
    });

    it('should return error without token', async () => {
      const response = await request(app)
        .get('/auth/me');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should return error with invalid token', async () => {
      const response = await request(app)
        .get('/auth/me')
        .set('Authorization', 'Bearer invalidtoken');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Invalid token');
    });
  });

  describe('Protected Routes', () => {
    it('should allow admin access to protected route', async () => {
      // Login as admin first
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'admin@test.com',
          password: 'Password123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('token');

      const token = loginResponse.body.token;

      const response = await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Admin access granted');
    });

    it('should deny access to protected route without token', async () => {
      const response = await request(app)
        .get('/admin');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error', 'Access token required');
    });

    it('should deny access to protected route with insufficient permissions', async () => {
      // Login as guest (who doesn't have create_user permission)
      const loginResponse = await request(app)
        .post('/auth/login')
        .send({
          email: 'guest@test.com',
          password: 'Password123!'
        });

      expect(loginResponse.status).toBe(200);
      expect(loginResponse.body).toHaveProperty('token');

      const token = loginResponse.body.token;

      const response = await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error', 'Insufficient permissions');
    });
  });
});