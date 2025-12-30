import request from 'supertest';
import app from '../../../src/app';
import sequelize from '../../../src/config/database';
import { setupTestDatabase } from '../../testHelpers';
import User from '../../../src/models/User';
import Role from '../../../src/models/Role';
import Property from '../../../src/models/Property';
import Week from '../../../src/models/Week';
import PropertyTier from '../../../src/models/PropertyTier';
import RoomTypeMultiplier from '../../../src/models/RoomTypeMultiplier';
import SeasonalCalendar from '../../../src/models/SeasonalCalendar';
import UserCreditWallet from '../../../src/models/UserCreditWallet';
import CreditTransaction from '../../../src/models/CreditTransaction';

describe('Credit Wallet API Integration Tests', () => {
  let testUser: User;
  let testProperty: Property;
  let testWeek: Week;
  let testTier: PropertyTier;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up test data using TRUNCATE (faster and handles FK constraints)
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await CreditTransaction.destroy({ where: {}, truncate: true });
    await UserCreditWallet.destroy({ where: {}, truncate: true });
    await Week.destroy({ where: {}, truncate: true });
    await SeasonalCalendar.destroy({ where: {}, truncate: true });
    await Property.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });
    await Role.destroy({ where: {}, truncate: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create user role
    const userRole = await Role.create({ name: 'user', description: 'Regular user' });

    // Create test user
    testUser = await User.create({
      email: 'credituser@test.com',
      password: 'hashedpassword',
      firstName: 'Credit',
      lastName: 'User',
      role_id: userRole.id,
      status: 'approved'
    });

    // Mock auth token
    authToken = 'Bearer test-token-' + testUser.id;

    // Create property tier
    testTier = await PropertyTier.create({
      tier_code: 'GOLD',
      tier_name: 'Gold Properties',
      location_multiplier: 1.2,
      display_order: 2
    });

    // Create test property
    testProperty = await Property.create({
      name: 'Test Resort',
      address: '123 Test St',
      city: 'Test City',
      country: 'Test Country',
      location: 'Test City, Test Country',
      tier: 'GOLD',
      location_multiplier: 1.20
    });

    // Create seasonal calendar
    await SeasonalCalendar.create({
      property_id: testProperty.id,
      season_type: 'RED',
      start_date: new Date('2025-07-01'),
      end_date: new Date('2025-08-31'),
      year: 2025
    });

    // Create room multiplier
    await RoomTypeMultiplier.create({
      room_type: 'DELUXE',
      multiplier: 1.5,
      is_active: true,
      display_order: 3
    });

    // Create test week
    testWeek = await Week.create({
      property_id: testProperty.id,
      owner_id: testUser.id,
      week_number: 30,
      year: 2025,
      start_date: new Date('2025-07-21'),
      end_date: new Date('2025-07-28'),
      room_type: 'DELUXE',
      deposited_for_credits: false
    });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  describe('GET /api/credits/wallet/:userId', () => {
    it('should return empty wallet for new user', async () => {
      const response = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.wallet.totalBalance).toBe(0);
      expect(response.body.data.wallet.totalEarned).toBe(0);
      expect(response.body.data.wallet.totalSpent).toBe(0);
      expect(response.body.data.activeTransactions).toHaveLength(0);
    });

    it('should return wallet with balance after deposit', async () => {
      // First deposit a week
      await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      // Then get wallet
      const response = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.wallet.totalBalance).toBeGreaterThan(0);
      expect(response.body.data.wallet.totalEarned).toBeGreaterThan(0);
      expect(response.body.data.activeTransactions.length).toBeGreaterThan(0);
    });

    it('should return 400 for invalid user ID', async () => {
      const response = await request(app)
        .get('/api/credits/wallet/invalid')
        .set('Authorization', authToken);

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/credits/deposit', () => {
    it('should successfully deposit week for credits', async () => {
      const response = await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creditsEarned).toBe(1800); // 1000 * 1.2 * 1.5
      expect(response.body.data.expiresAt).toBeDefined();
      expect(response.body.data.wallet.totalBalance).toBe(1800);

      // Verify week is marked as deposited
      const updatedWeek = await Week.findByPk(testWeek.id);
      expect(updatedWeek?.deposited_for_credits).toBe(true);
      expect(updatedWeek?.credits_earned).toBe(1800);
    });

    it('should create transaction record', async () => {
      await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      const transactions = await CreditTransaction.findAll({
        where: { user_id: testUser.id }
      });

      expect(transactions).toHaveLength(1);
      expect(transactions[0].transaction_type).toBe('DEPOSIT');
      expect(transactions[0].amount).toBe('1800.00');
      expect(transactions[0].status).toBe('ACTIVE');
      expect(transactions[0].week_id).toBe(testWeek.id);
    });

    it('should return 400 if userId or weekId missing', async () => {
      const response = await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id
          // weekId missing
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    it('should handle non-existent week gracefully', async () => {
      const response = await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: 99999
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/credits/estimate', () => {
    it('should estimate credits correctly', async () => {
      const response = await request(app)
        .post('/api/credits/estimate')
        .set('Authorization', authToken)
        .send({
          propertyId: testProperty.id,
          roomType: 'DELUXE',
          weekStartDate: '2025-07-21'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.estimatedCredits).toBe(1800);
      expect(response.body.data.seasonType).toBe('RED');
      expect(response.body.data.breakdown.baseValue).toBe(1000);
      expect(response.body.data.breakdown.locationMultiplier).toBe(1.2);
      expect(response.body.data.breakdown.roomTypeMultiplier).toBe(1.5);
    });

    it('should return 400 if parameters missing', async () => {
      const response = await request(app)
        .post('/api/credits/estimate')
        .set('Authorization', authToken)
        .send({
          propertyId: testProperty.id
          // roomType and weekStartDate missing
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/credits/transactions/:userId', () => {
    it('should return empty array for user with no transactions', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${testUser.id}`)
        .set('Authorization', authToken);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('should return transactions with pagination', async () => {
      // Create some transactions
      await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      const response = await request(app)
        .get(`/api/credits/transactions/${testUser.id}`)
        .set('Authorization', authToken)
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.transactions.length).toBeGreaterThan(0);
      expect(response.body.data.pagination).toBeDefined();
      expect(response.body.data.pagination.limit).toBe(10);
    });

    it('should handle pagination correctly', async () => {
      const response = await request(app)
        .get(`/api/credits/transactions/${testUser.id}`)
        .set('Authorization', authToken)
        .query({ limit: 5, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body.data.pagination.limit).toBe(5);
      expect(response.body.data.pagination.offset).toBe(0);
    });
  });

  describe('POST /api/credits/check-affordability', () => {
    it('should return canAfford true when user has sufficient credits', async () => {
      // First deposit
      await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      // Check affordability
      const response = await request(app)
        .post('/api/credits/check-affordability')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          creditsRequired: 1000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.canAfford).toBe(true);
      expect(response.body.data.availableBalance).toBe(1800);
      expect(response.body.data.shortfall).toBe(0);
      expect(response.body.data.hybridPayment).toBeNull();
    });

    it('should return canAfford false and hybrid payment when insufficient', async () => {
      // User has 0 credits, needs 1000
      const response = await request(app)
        .post('/api/credits/check-affordability')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          creditsRequired: 1000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.canAfford).toBe(false);
      expect(response.body.data.shortfall).toBe(1000);
      expect(response.body.data.hybridPayment).toBeDefined();
      expect(response.body.data.hybridPayment.creditsUsed).toBe(0);
      expect(response.body.data.hybridPayment.cashRequired).toBeGreaterThan(0);
    });

    it('should calculate partial hybrid payment correctly', async () => {
      // Deposit week (1800 credits)
      await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      // Need 2500 credits (shortfall of 700)
      const response = await request(app)
        .post('/api/credits/check-affordability')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          creditsRequired: 2500
        });

      expect(response.status).toBe(200);
      expect(response.body.data.canAfford).toBe(false);
      expect(response.body.data.shortfall).toBe(700);
      expect(response.body.data.hybridPayment.creditsUsed).toBe(1800);
      expect(response.body.data.hybridPayment.creditShortfall).toBe(700);
    });
  });

  describe('GET /api/credits/rate', () => {
    it('should return conversion rate', async () => {
      const response = await request(app)
        .get('/api/credits/rate');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creditToEuroRate).toBeDefined();
      expect(response.body.data.oneCredit).toBeDefined();
    });
  });

  describe('POST /api/credits/refund', () => {
    it('should refund credits successfully', async () => {
      // First deposit
      await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      // Create a mock booking ID
      const bookingId = 1;

      // Refund
      const response = await request(app)
        .post('/api/credits/refund')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          bookingId: bookingId,
          creditsToRefund: 500,
          reason: 'Booking cancelled by user'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.creditsRefunded).toBe(500);

      // Verify wallet balance increased
      const walletResponse = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(walletResponse.body.data.wallet.totalBalance).toBe(2300); // 1800 + 500
    });

    it('should return 400 if required fields missing', async () => {
      const response = await request(app)
        .post('/api/credits/refund')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id
          // bookingId and creditsToRefund missing
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });
  });
});
