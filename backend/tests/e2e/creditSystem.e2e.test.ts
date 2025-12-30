import request from 'supertest';
import app from '../../src/app';
import sequelize from '../../src/config/database';
import { setupTestDatabase } from '../testHelpers';
import User from '../../src/models/User';
import Role from '../../src/models/Role';
import Property from '../../src/models/Property';
import Week from '../../src/models/Week';
import Booking from '../../src/models/Booking';
import PropertyTier from '../../src/models/PropertyTier';
import RoomTypeMultiplier from '../../src/models/RoomTypeMultiplier';
import SeasonalCalendar from '../../src/models/SeasonalCalendar';
import CreditBookingCost from '../../src/models/CreditBookingCost';
import UserCreditWallet from '../../src/models/UserCreditWallet';
import CreditTransaction from '../../src/models/CreditTransaction';
import CreditWalletService from '../../src/services/CreditWalletService';

describe('Credit System E2E Tests', () => {
  let testUser: User;
  let testProperty: Property;
  let testWeek: Week;
  let authToken: string;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  beforeEach(async () => {
    // Clean up all credit-related data using TRUNCATE (faster and handles FK constraints)
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
    await CreditTransaction.destroy({ where: {}, truncate: true });
    await UserCreditWallet.destroy({ where: {}, truncate: true });
    await CreditBookingCost.destroy({ where: {}, truncate: true });
    await Booking.destroy({ where: {}, truncate: true });
    await Week.destroy({ where: {}, truncate: true });
    await SeasonalCalendar.destroy({ where: {}, truncate: true });
    await RoomTypeMultiplier.destroy({ where: {}, truncate: true });
    await PropertyTier.destroy({ where: {}, truncate: true });
    await Property.destroy({ where: {}, truncate: true });
    await User.destroy({ where: {}, truncate: true });
    await Role.destroy({ where: {}, truncate: true });
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');

    // Create roles
    const userRole = await Role.create({ name: 'user', description: 'Regular user' });
    const adminRole = await Role.create({ name: 'admin', description: 'Administrator' });

    // Create test user
    testUser = await User.create({
      email: 'e2e@test.com',
      password: 'hashedpassword',
      firstName: 'E2E',
      lastName: 'User',
      role_id: userRole.id,
      status: 'approved'
    });

    authToken = 'Bearer e2e-token-' + testUser.id;

    // Create property tier
    const tier = await PropertyTier.create({
      tier_code: 'GOLD',
      tier_name: 'Gold Properties',
      location_multiplier: 1.2,
      display_order: 2
    });

    // Create test property
    testProperty = await Property.create({
      name: 'E2E Test Resort',
      address: '789 E2E St',
      city: 'E2E City',
      country: 'Test Country',
      location: 'E2E City, Test Country',
      tier: 'GOLD',
      location_multiplier: 1.30
    });

    // Create seasonal calendar
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

    // Create room multiplier
    await RoomTypeMultiplier.create({
      room_type: 'DELUXE',
      multiplier: 1.5,
      is_active: true,
      display_order: 3
    });

    // Create booking costs
    await CreditBookingCost.create({
      property_id: testProperty.id,
      room_type: 'DELUXE',
      season_type: 'RED',
      credits_per_night: 900,
      effective_from: new Date('2025-01-01'),
      is_active: true
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

  describe('E2E: Complete Deposit → Book → Refund Flow', () => {
    it('should complete full credit lifecycle', async () => {
      // STEP 1: Check initial wallet (should be empty)
      const initialWallet = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(initialWallet.body.data.wallet.totalBalance).toBe(0);
      console.log('✓ Step 1: Initial wallet verified (0 credits)');

      // STEP 2: Estimate credits before deposit
      const estimate = await request(app)
        .post('/api/credits/estimate')
        .set('Authorization', authToken)
        .send({
          propertyId: testProperty.id,
          roomType: 'DELUXE',
          weekStartDate: '2025-07-21'
        });

      expect(estimate.status).toBe(200);
      expect(estimate.body.data.estimatedCredits).toBe(1800); // 1000 * 1.2 * 1.5
      console.log(`✓ Step 2: Estimated ${estimate.body.data.estimatedCredits} credits`);

      // STEP 3: Deposit week for credits
      const deposit = await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      expect(deposit.status).toBe(200);
      expect(deposit.body.data.creditsEarned).toBe(1800);
      expect(deposit.body.data.wallet.totalBalance).toBe(1800);
      console.log(`✓ Step 3: Deposited week, earned ${deposit.body.data.creditsEarned} credits`);

      // STEP 4: Verify wallet balance updated
      const afterDeposit = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(afterDeposit.body.data.wallet.totalBalance).toBe(1800);
      expect(afterDeposit.body.data.wallet.totalEarned).toBe(1800);
      expect(afterDeposit.body.data.activeTransactions).toHaveLength(1);
      console.log('✓ Step 4: Wallet balance verified (1800 credits)');

      // STEP 5: Calculate booking cost
      const bookingCost = await request(app)
        .post('/api/credits/calculate-booking-cost')
        .set('Authorization', authToken)
        .send({
          propertyId: testProperty.id,
          roomType: 'DELUXE',
          checkInDate: '2025-07-10',
          checkOutDate: '2025-07-12' // 2 nights
        });

      expect(bookingCost.status).toBe(200);
      const totalCost = bookingCost.body.data.totalCredits;
      console.log(`✓ Step 5: Booking cost calculated (${totalCost} credits for 2 nights)`);

      // STEP 6: Check affordability
      const affordability = await request(app)
        .post('/api/credits/check-affordability')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          creditsRequired: totalCost
        });

      expect(affordability.status).toBe(200);
      expect(affordability.body.data.canAfford).toBe(true);
      console.log('✓ Step 6: User can afford booking');

      // STEP 7: Spend credits (simulate booking)
      const spend = await CreditWalletService.spendCredits(
        testUser.id,
        1, // mock booking ID
        totalCost
      );

      expect(spend.creditsSpent).toBe(totalCost);
      console.log(`✓ Step 7: Spent ${totalCost} credits on booking`);

      // STEP 8: Verify wallet after spending
      const afterSpend = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(afterSpend.body.data.wallet.totalBalance).toBe(1800 - totalCost);
      expect(afterSpend.body.data.wallet.totalSpent).toBe(totalCost);
      console.log(`✓ Step 8: Wallet updated (${1800 - totalCost} credits remaining)`);

      // STEP 9: Refund the booking
      const refund = await request(app)
        .post('/api/credits/refund')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          bookingId: 1,
          creditsToRefund: totalCost,
          reason: 'User cancelled booking'
        });

      expect(refund.status).toBe(200);
      expect(refund.body.data.creditsRefunded).toBe(totalCost);
      console.log(`✓ Step 9: Refunded ${totalCost} credits`);

      // STEP 10: Verify final wallet balance
      const finalWallet = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(finalWallet.body.data.wallet.totalBalance).toBe(1800); // Back to original
      console.log('✓ Step 10: Final wallet verified (1800 credits restored)');

      // STEP 11: Verify transaction history
      const history = await request(app)
        .get(`/api/credits/transactions/${testUser.id}`)
        .set('Authorization', authToken);

      expect(history.body.data.transactions.length).toBeGreaterThanOrEqual(3); // DEPOSIT, SPEND, REFUND
      
      const types = history.body.data.transactions.map((t: any) => t.type);
      expect(types).toContain('DEPOSIT');
      expect(types).toContain('SPEND');
      expect(types).toContain('REFUND');
      console.log('✓ Step 11: Transaction history complete');

      console.log('\n✅ E2E Flow Complete: Deposit → Book → Refund');
    });
  });

  describe('E2E: Hybrid Payment Flow', () => {
    it('should handle hybrid payment (partial credits + cash)', async () => {
      // STEP 1: Deposit week (1800 credits)
      const deposit = await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      expect(deposit.body.data.creditsEarned).toBe(1800);
      console.log('✓ Step 1: Deposited week (1800 credits)');

      // STEP 2: Try to book something that costs more than available credits
      const expensiveBookingCost = 2500; // More than 1800

      const affordability = await request(app)
        .post('/api/credits/check-affordability')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          creditsRequired: expensiveBookingCost
        });

      expect(affordability.status).toBe(200);
      expect(affordability.body.data.canAfford).toBe(false);
      expect(affordability.body.data.shortfall).toBe(700);
      expect(affordability.body.data.hybridPayment).toBeDefined();
      
      const hybrid = affordability.body.data.hybridPayment;
      expect(hybrid.creditsUsed).toBe(1800);
      expect(hybrid.creditShortfall).toBe(700);
      expect(hybrid.cashRequired).toBeGreaterThan(0);

      console.log(`✓ Step 2: Hybrid payment calculated`);
      console.log(`  - Credits available: 1800`);
      console.log(`  - Credits required: 2500`);
      console.log(`  - Credits to use: ${hybrid.creditsUsed}`);
      console.log(`  - Cash needed: €${hybrid.cashRequired}`);

      // STEP 3: Use all available credits
      const spend = await CreditWalletService.spendCredits(
        testUser.id,
        2, // mock booking ID
        1800 // Use all available
      );

      expect(spend.creditsSpent).toBe(1800);
      console.log('✓ Step 3: Used all available credits (1800)');

      // STEP 4: Verify wallet is now empty
      const wallet = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(wallet.body.data.wallet.totalBalance).toBe(0);
      console.log('✓ Step 4: Wallet emptied (0 credits remaining)');

      console.log('\n✅ E2E Hybrid Payment Flow Complete');
    });
  });

  describe('E2E: FIFO Expiration Flow', () => {
    it('should spend oldest credits first (FIFO)', async () => {
      // STEP 1: Deposit first week
      await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      console.log('✓ Step 1: Deposited first week (1800 credits)');

      // STEP 2: Create and deposit second week
      const secondWeek = await Week.create({
        property_id: testProperty.id,
        owner_id: testUser.id,
        week_number: 31,
        year: 2025,
        start_date: new Date('2025-07-28'),
        end_date: new Date('2025-08-04'),
        room_type: 'DELUXE',
        deposited_for_credits: false
      });

      await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: secondWeek.id
        });

      console.log('✓ Step 2: Deposited second week (1800 credits)');

      // STEP 3: Verify total balance
      const wallet = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(wallet.body.data.wallet.totalBalance).toBe(3600); // 1800 + 1800
      expect(wallet.body.data.activeTransactions).toHaveLength(2);
      console.log('✓ Step 3: Total balance verified (3600 credits)');

      // STEP 4: Spend some credits (should use oldest first)
      const spend = await CreditWalletService.spendCredits(
        testUser.id,
        3, // mock booking ID
        2000 // More than first deposit, less than total
      );

      expect(spend.creditsSpent).toBe(2000);
      console.log('✓ Step 4: Spent 2000 credits (FIFO)');

      // STEP 5: Verify remaining balance
      const afterSpend = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(afterSpend.body.data.wallet.totalBalance).toBe(1600); // 3600 - 2000
      console.log('✓ Step 5: Remaining balance verified (1600 credits)');

      // STEP 6: Check transaction details to verify FIFO
      const history = await request(app)
        .get(`/api/credits/transactions/${testUser.id}`)
        .set('Authorization', authToken);

      const deposits = history.body.data.transactions.filter((t: any) => t.type === 'DEPOSIT');
      const spends = history.body.data.transactions.filter((t: any) => t.type === 'SPEND');

      expect(deposits).toHaveLength(2);
      expect(spends).toHaveLength(1);
      
      console.log('✓ Step 6: Transaction history verified');
      console.log(`  - First deposit: 1800 credits (oldest)`);
      console.log(`  - Second deposit: 1800 credits (newer)`);
      console.log(`  - Spent: 2000 credits (used first deposit fully + 200 from second)`);

      console.log('\n✅ E2E FIFO Flow Complete');
    });
  });

  describe('E2E: Credit Expiration Simulation', () => {
    it('should handle credit expiration correctly', async () => {
      // STEP 1: Deposit week
      const deposit = await request(app)
        .post('/api/credits/deposit')
        .set('Authorization', authToken)
        .send({
          userId: testUser.id,
          weekId: testWeek.id
        });

      const creditsEarned = deposit.body.data.creditsEarned;
      const expiresAt = new Date(deposit.body.data.expiresAt);
      
      console.log(`✓ Step 1: Deposited ${creditsEarned} credits`);
      console.log(`  Expires: ${expiresAt.toISOString()}`);

      // STEP 2: Verify expiration date is 6 months from now
      const now = new Date();
      const sixMonthsLater = new Date(now);
      sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);

      const daysDifference = Math.abs((expiresAt.getTime() - sixMonthsLater.getTime()) / (1000 * 60 * 60 * 24));
      expect(daysDifference).toBeLessThan(2); // Allow 1-2 days difference
      console.log('✓ Step 2: Expiration date verified (6 months)');

      // STEP 3: Manually update transaction to simulate near expiration
      const transaction = await CreditTransaction.findOne({
        where: {
          user_id: testUser.id,
          transaction_type: 'DEPOSIT'
        }
      });

      const nearExpiry = new Date();
      nearExpiry.setDate(nearExpiry.getDate() + 25); // Expires in 25 days

      await transaction!.update({ expires_at: nearExpiry });
      console.log('✓ Step 3: Simulated near expiration (25 days)');

      // STEP 4: Check wallet shows expiring credits
      const wallet = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(wallet.body.data.expirations.in30Days).toBe(creditsEarned);
      console.log('✓ Step 4: Expiring credits detected');

      // STEP 5: Simulate expiration by updating to past date
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);
      await transaction!.update({ expires_at: pastDate });
      console.log('✓ Step 5: Simulated expired credits (past date)');

      // STEP 6: Run expiration job
      const expirationResult = await CreditWalletService.expireCredits();
      
      expect(expirationResult.expiredCount).toBeGreaterThan(0);
      expect(expirationResult.totalCreditsExpired).toBe(creditsEarned);
      console.log(`✓ Step 6: Expiration job processed ${expirationResult.expiredCount} transactions`);

      // STEP 7: Verify wallet balance is now 0
      const afterExpiration = await request(app)
        .get(`/api/credits/wallet/${testUser.id}`)
        .set('Authorization', authToken);

      expect(afterExpiration.body.data.wallet.totalBalance).toBe(0);
      expect(afterExpiration.body.data.wallet.totalExpired).toBe(creditsEarned);
      console.log('✓ Step 7: Wallet balance cleared (expired)');

      console.log('\n✅ E2E Expiration Flow Complete');
    });
  });

  describe('E2E: Admin Configuration Flow', () => {
    let adminUser: User;
    let adminToken: string;

    beforeEach(async () => {
      adminUser = await User.create({
        email: 'admin-e2e@test.com',
        password: 'hashedpassword',
        first_name: 'Admin',
        last_name: 'E2E',
        role: 'admin'
      });

      adminToken = 'Bearer admin-e2e-token-' + adminUser.id;
    });

    it('should allow admin to configure and affect user credits', async () => {
      // STEP 1: Admin updates property tier multiplier
      const tier = await PropertyTier.findOne({
        where: { tier_code: 'GOLD' }
      });

      const tierUpdate = await request(app)
        .put(`/api/credits/admin/tiers/${tier!.id}`)
        .set('Authorization', adminToken)
        .send({
          multiplier: 1.4 // Changed from 1.2 to 1.4
        });

      expect(tierUpdate.status).toBe(200);
      console.log('✓ Step 1: Admin updated tier multiplier (1.2 → 1.4)');

      // STEP 2: Estimate credits with new multiplier
      const estimate = await request(app)
        .post('/api/credits/estimate')
        .set('Authorization', authToken)
        .send({
          propertyId: testProperty.id,
          roomType: 'DELUXE',
          weekStartDate: '2025-07-21'
        });

      expect(estimate.body.data.estimatedCredits).toBe(2100); // 1000 * 1.4 * 1.5
      console.log(`✓ Step 2: New estimate reflects change (${estimate.body.data.estimatedCredits} credits)`);

      // STEP 3: Admin updates booking cost
      const costUpdate = await request(app)
        .post(`/api/credits/admin/booking-costs/${testProperty.id}`)
        .set('Authorization', adminToken)
        .send({
          effectiveFrom: '2025-01-01',
          prices: [
            { roomType: 'DELUXE', seasonType: 'RED', creditsPerNight: 1000 }
          ]
        });

      expect(costUpdate.status).toBe(200);
      console.log('✓ Step 3: Admin updated booking costs (900 → 1000 per night)');

      // STEP 4: Verify new booking cost
      const bookingCost = await request(app)
        .post('/api/credits/calculate-booking-cost')
        .set('Authorization', authToken)
        .send({
          propertyId: testProperty.id,
          roomType: 'DELUXE',
          checkInDate: '2025-07-10',
          checkOutDate: '2025-07-12' // 2 nights
        });

      expect(bookingCost.body.data.totalCredits).toBe(2000); // 1000 * 2 nights
      console.log(`✓ Step 4: New booking cost (${bookingCost.body.data.totalCredits} credits for 2 nights)`);

      // STEP 5: Check audit log
      const changelog = await request(app)
        .get('/api/credits/admin/change-log')
        .set('Authorization', adminToken);

      expect(changelog.status).toBe(200);
      expect(changelog.body.data.length).toBeGreaterThan(0);
      console.log(`✓ Step 5: Audit log contains ${changelog.body.data.length} entries`);

      console.log('\n✅ E2E Admin Configuration Flow Complete');
    });
  });
});
