/**
 * CreditController Integration Tests (Phase 3.5)
 * 
 * Tests HTTP endpoints for credit account operations.
 * Uses vitest + supertest for API testing.
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../../../../src/app';
import sequelize from '../../../../src/config/database';
import User from '../../../../src/models/User';
import Role from '../../../../src/models/Role';
import { initV2Models } from '../../../../src/models/v2';
import CreditAccount from '../../../../src/models/v2/CreditAccount';
import CreditTransaction from '../../../../src/models/v2/CreditTransaction';
import jwt from 'jsonwebtoken';

describe('CreditController Integration Tests', () => {
  let testUser: User;
  let testAccount: CreditAccount;
  let authToken: string;

  beforeAll(async () => {
    await sequelize.authenticate();
    initV2Models(sequelize);
  });

  beforeEach(async () => {
    // Clean up
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await CreditTransaction.destroy({ where: {}, truncate: true, force: true });
    await CreditAccount.destroy({ where: {}, truncate: true, force: true });
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
      email: 'credituser@test.com',
      password: 'hashedpassword',
      firstName: 'Credit',
      lastName: 'User',
      role_id: userRole.id,
      status: 'approved',
    });

    // Generate auth token
    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email, role: 'user' },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );

    // Create credit account with balance
    testAccount = await CreditAccount.create({
      user_id: testUser.id,
      balance: 1500,
      currency: 'EUR',
      expiration_policy: '2_YEARS',
      credit_limit: 5000,
    });

    // Create some transactions
    await CreditTransaction.create({
      account_id: testAccount.id,
      type: 'WEEK_RELEASE',
      amount: 1000,
      balance_before: 0,
      balance_after: 1000,
      description: 'Released Week 25',
      reference_type: 'week_allocation',
      reference_id: 1,
    });

    await CreditTransaction.create({
      account_id: testAccount.id,
      type: 'WEEK_BOOKING',
      amount: -500,
      balance_before: 1000,
      balance_after: 500,
      description: 'Booked Week 30',
      reference_type: 'booking',
      reference_id: 1,
    });

    await CreditTransaction.create({
      account_id: testAccount.id,
      type: 'CREDIT_PURCHASE',
      amount: 1000,
      balance_before: 500,
      balance_after: 1500,
      description: 'Purchased 1000 credits',
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/v2/credits/balance', () => {
    it('should return user credit balance', async () => {
      const response = await request(app)
        .get('/api/v2/credits/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toMatchObject({
        balance: 1500,
        currency: 'EUR',
        expirationPolicy: '2_YEARS',
        creditLimit: 5000,
      });
      expect(response.body.data.lastTransactionAt).toBeDefined();
    });

    it('should return 0 balance for user without account', async () => {
      // Create user without credit account
      const newUser = await User.create({
        email: 'newuser@test.com',
        password: 'hashedpassword',
        firstName: 'New',
        lastName: 'User',
        role_id: testUser.role_id,
        status: 'approved',
      });

      const newToken = jwt.sign(
        { id: newUser.id, email: newUser.email, role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v2/credits/balance')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(0);
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get('/api/v2/credits/balance')
        .expect(401);
    });
  });

  describe('GET /api/v2/credits/transactions', () => {
    it('should return paginated transaction history', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 10,
        totalTransactions: 3,
      });
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions?page=1&limit=2')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(2);
      expect(response.body.meta).toMatchObject({
        page: 1,
        limit: 2,
        totalTransactions: 3,
      });
    });

    it('should filter by transaction type', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions?type=WEEK_RELEASE')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].type).toBe('WEEK_RELEASE');
    });

    it('should return empty array for user without transactions', async () => {
      // Create user without transactions
      const newUser = await User.create({
        email: 'newuser2@test.com',
        password: 'hashedpassword',
        firstName: 'New',
        lastName: 'User2',
        role_id: testUser.role_id,
        status: 'approved',
      });

      await CreditAccount.create({
        user_id: newUser.id,
        balance: 0,
        currency: 'EUR',
      });

      const newToken = jwt.sign(
        { id: newUser.id, email: newUser.email, role: 'user' },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v2/credits/transactions')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual([]);
      expect(response.body.meta.totalTransactions).toBe(0);
    });

    it('should return transactions in descending order (newest first)', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data;
      
      // Verify order (CREDIT_PURCHASE should be first, WEEK_RELEASE last)
      expect(transactions[0].type).toBe('CREDIT_PURCHASE');
      expect(transactions[2].type).toBe('WEEK_RELEASE');
    });

    it('should return 401 without auth token', async () => {
      await request(app)
        .get('/api/v2/credits/transactions')
        .expect(401);
    });
  });

  describe('POST /api/v2/credits/purchase', () => {
    it('should return stub response (not implemented)', async () => {
      const response = await request(app)
        .post('/api/v2/credits/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 1000,
          paymentMethod: 'stripe',
        })
        .expect(501);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not implemented');
    });
  });
});
