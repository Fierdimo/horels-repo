/**
 * CreditController Integration Tests
 * 
 * Tests HTTP endpoints for credit account operations.
 */

import request from 'supertest';
import { Express } from 'express';
import { Sequelize } from 'sequelize';
import jwt from 'jsonwebtoken';
import { setupTestDatabase, cleanupTestDatabase } from '../../helpers/testDatabaseSetup';
import User from '../../../src/models/User';
import CreditAccount from '../../../src/models/v2/CreditAccount';
import CreditTransaction from '../../../src/models/v2/CreditTransaction';

let app: Express;
let sequelize: Sequelize;
let testUser: User;
let testAccount: CreditAccount;
let authToken: string;

describe('CreditController', () => {
  beforeAll(async () => {
    sequelize = await setupTestDatabase();
    
    // Create Express app
    const express = require('express');
    app = express();
    app.use(express.json());
    
    const { authenticateToken } = require('../../../src/middleware/auth');
    const creditRoutes = require('../../../src/routes/v2/creditRoutes').default;
    
    app.use('/api/v2/credits', authenticateToken, creditRoutes);
  });

  afterAll(async () => {
    await cleanupTestDatabase(sequelize);
  });

  beforeEach(async () => {
    // Clean tables
    await CreditTransaction.destroy({ where: {}, force: true });
    await CreditAccount.destroy({ where: {}, force: true });
    await User.destroy({ where: {}, force: true });

    // Create test user
    testUser = await User.create({
      email: 'owner@test.com',
      password: 'hashed_password',
      firstName: 'Test',
      lastName: 'Owner',
      role: 'owner',
    });

    authToken = jwt.sign(
      { id: testUser.id, email: testUser.email, role: testUser.role },
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
      last_transaction_at: new Date(),
    });

    // Create sample transactions
    await CreditTransaction.create({
      account_id: testAccount.id,
      type: 'WEEK_RELEASE',
      amount: 1080,
      balance_before: 0,
      balance_after: 1080,
      description: 'Released week 25',
      reference_type: 'week_allocation',
      reference_id: 1001,
    });

    await CreditTransaction.create({
      account_id: testAccount.id,
      type: 'CREDIT_PURCHASE',
      amount: 500,
      balance_before: 1080,
      balance_after: 1580,
      description: 'Purchased credits',
    });

    await CreditTransaction.create({
      account_id: testAccount.id,
      type: 'WEEK_BOOKING',
      amount: -80,
      balance_before: 1580,
      balance_after: 1500,
      description: 'Booked week 30',
      reference_type: 'booking',
      reference_id: 2001,
    });
  });

  describe('GET /api/v2/credits/balance', () => {
    it('should return user credit balance', async () => {
      const response = await request(app)
        .get('/api/v2/credits/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.balance).toBe(1500);
      expect(response.body.data.currency).toBe('EUR');
      expect(response.body.data.expirationPolicy).toBe('2_YEARS');
      expect(response.body.data.creditLimit).toBe(5000);
      expect(response.body.data.lastTransactionAt).toBeDefined();
    });

    it('should return 404 if account does not exist', async () => {
      // Create user without account
      const newUser = await User.create({
        email: 'noaccounts@test.com',
        password: 'hashed_password',
        firstName: 'No',
        lastName: 'Account',
        role: 'owner',
      });

      const newToken = jwt.sign(
        { id: newUser.id, email: newUser.email, role: newUser.role },
        process.env.JWT_SECRET || 'test-secret',
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/v2/credits/balance')
        .set('Authorization', `Bearer ${newToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not found');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/v2/credits/balance')
        .expect(401);
    });
  });

  describe('GET /api/v2/credits/transactions', () => {
    it('should return transaction history with pagination', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBe(3);
      expect(response.body.meta.count).toBe(3);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(10);
    });

    it('should filter by transaction type', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions')
        .query({ type: 'WEEK_RELEASE' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(1);
      expect(response.body.data[0].type).toBe('WEEK_RELEASE');
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions')
        .query({ page: 1, limit: 2 })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.length).toBe(2);
      expect(response.body.meta.page).toBe(1);
      expect(response.body.meta.limit).toBe(2);
    });

    it('should return transactions in reverse chronological order', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data;
      
      // Most recent first (WEEK_BOOKING)
      expect(transactions[0].type).toBe('WEEK_BOOKING');
      expect(transactions[0].amount).toBe(-80);
      
      // Oldest last (WEEK_RELEASE)
      expect(transactions[2].type).toBe('WEEK_RELEASE');
      expect(transactions[2].amount).toBe(1080);
    });

    it('should include transaction metadata', async () => {
      const response = await request(app)
        .get('/api/v2/credits/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      const transactions = response.body.data;
      
      transactions.forEach((tx: any) => {
        expect(tx).toHaveProperty('id');
        expect(tx).toHaveProperty('type');
        expect(tx).toHaveProperty('amount');
        expect(tx).toHaveProperty('balance_before');
        expect(tx).toHaveProperty('balance_after');
        expect(tx).toHaveProperty('description');
        expect(tx).toHaveProperty('created_at');
      });
    });
  });

  describe('POST /api/v2/credits/purchase', () => {
    it('should return 501 (not implemented)', async () => {
      const response = await request(app)
        .post('/api/v2/credits/purchase')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 1000 })
        .expect(501);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('not implemented');
    });
  });
});
