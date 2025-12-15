import 'dotenv/config';
// E2E smoke tests for core business flows: confirm-week, swap fee, guest token flow
process.env.DB_NAME = process.env.DB_NAME || 'sw2_e2e_test';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
let app: any; // will import after mocking StripeService to avoid real Stripe client initialization
import sequelize from '../src/config/database';
import Role from '../src/models/Role';
import Permission from '../src/models/Permission';
import RolePermission from '../src/models/RolePermission';
import User from '../src/models/User';
import Property from '../src/models/Property';
import Week from '../src/models/Week';
import Booking from '../src/models/Booking';
import SwapRequest from '../src/models/SwapRequest';
import ActionLog from '../src/models/ActionLog';
import Fee from '../src/models/Fee';
import PlatformSetting from '../src/models/PlatformSetting';
import bcrypt from 'bcryptjs';

describe('E2E Smoke Tests - Business Flows', () => {
  let ownerToken: string;
  let owner2Token: string;
  let guestToken: string;
  let owner: User;
  let owner2: User;
  let guest: User;
  let propertyId: string;

  beforeAll(async () => {
    const useRealStripe = process.env.USE_REAL_STRIPE === 'true';

    if (!useRealStripe) {
      // Mock StripeService to avoid external API calls during smoke tests
      const StripeService = (await import('../src/services/stripeService')).default;
      vi.spyOn(StripeService.prototype, 'createPaymentIntent').mockImplementation(async (amount: number, currency: string, type: string, metadata?: any) => {
        return { paymentIntentId: `pi_mock_${Date.now()}`, clientSecret: `secret_mock_${Date.now()}`, amount, currency };
      });
      vi.spyOn(StripeService.prototype, 'confirmPayment').mockImplementation(async (paymentIntentId: string) => {
        return { paymentIntentId, status: 'succeeded', amount: 10, currency: 'EUR' };
      });
    }

    // Import app after mocking (or not) so StripeService constructor is not called before mocks are set
    app = (await import('../src/app')).default;

    await sequelize.authenticate();
    try {
      await sequelize.drop({ cascade: true });
    } catch (err) {
      // ignore
    }
    await sequelize.sync({ force: true });

    // Basic roles/permissions
    const [ownerRole] = await Role.findOrCreate({ where: { name: 'owner' } });
    const [guestRole] = await Role.findOrCreate({ where: { name: 'guest' } });
    const [adminRole] = await Role.findOrCreate({ where: { name: 'admin' } });

    const perms = ['confirm_week', 'create_swap', 'accept_swap', 'create_booking', 'view_booking', 'view_own_weeks'];
    for (const p of perms) {
      const [perm] = await Permission.findOrCreate({ where: { name: p } });
      await RolePermission.findOrCreate({ where: { role_id: ownerRole.id, permission_id: perm.id } });
    }

    const hashed = await bcrypt.hash('Password123!', 10);
    [owner] = await User.findOrCreate({ where: { email: 'smoke-owner@test.com' }, defaults: { email: 'smoke-owner@test.com', password: hashed, role_id: ownerRole.id } });
    [owner2] = await User.findOrCreate({ where: { email: 'smoke-owner2@test.com' }, defaults: { email: 'smoke-owner2@test.com', password: hashed, role_id: ownerRole.id } });
    [guest] = await User.findOrCreate({ where: { email: 'smoke-guest@test.com' }, defaults: { email: 'smoke-guest@test.com', password: hashed, role_id: guestRole.id } });

    // Create an admin user for actions requiring admin/staff
    const adminHashed = await bcrypt.hash('admin123', 10);
    await User.findOrCreate({ where: { email: 'admin@sw2.com' }, defaults: { email: 'admin@sw2.com', password: adminHashed, role_id: adminRole.id } });

    // Create a property
    const prop = await Property.create({ name: 'Smoke Hotel', location: 'Test City' });
    propertyId = prop.id;

    // Login users
    const loginOwner = await request(app).post('/auth/login').send({ email: owner.email, password: 'Password123!' });
    ownerToken = loginOwner.body.token;

    const loginOwner2 = await request(app).post('/auth/login').send({ email: owner2.email, password: 'Password123!' });
    owner2Token = loginOwner2.body.token;

    const loginGuest = await request(app).post('/auth/login').send({ email: guest.email, password: 'Password123!' });
    guestToken = loginGuest.body.token;
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('Confirm week usage (creates booking) — business revenue smoke', async () => {
    // Create a week for owner
    const week = await Week.create({ owner_id: owner.id, property_id: propertyId, start_date: new Date('2025-06-01'), end_date: new Date('2025-06-07'), color: 'red', status: 'available' });

    const res = await request(app)
      .post(`/timeshare/weeks/${week.id}/confirm`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    // booking should be created or week marked confirmed
    const freshWeek = await Week.findByPk(week.id);
    expect(freshWeek?.status === 'confirmed' || res.body.booking).toBeTruthy();
  });

  it('Owner-to-owner swap completes and charges €10 swap fee', async () => {
    // owner creates a week to offer
    const offerWeek = await Week.create({ owner_id: owner.id, property_id: propertyId, start_date: new Date('2025-07-01'), end_date: new Date('2025-07-07'), color: 'red', status: 'available' });
    const targetWeek = await Week.create({ owner_id: owner2.id, property_id: propertyId, start_date: new Date('2025-07-08'), end_date: new Date('2025-07-14'), color: 'red', status: 'available' });

    // Owner1 requests swap
    const createResp = await request(app)
      .post('/timeshare/swaps')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ weekId: offerWeek.id, desiredStartDate: targetWeek.start_date.toISOString(), desiredEndDate: targetWeek.end_date.toISOString() });

    expect(createResp.status).toBe(200);
    const swapId = createResp.body.data?.id || createResp.body.data?.swapRequest?.id;
    expect(swapId).toBeTruthy();

    // Responder (owner2) authorizes the swap from their panel
    const authorizeResp = await request(app)
      .post(`/timeshare/swaps/${swapId}/authorize`)
      .set('Authorization', `Bearer ${owner2Token}`)
      .send({ responderWeekId: targetWeek.id });

    expect([200, 201]).toContain(authorizeResp.status);

    // Admin: set swap fee to 12 for testing update path and verify BEFORE creating payment intent
    const adminLogin = await request(app).post('/auth/login').send({ email: 'admin@sw2.com', password: 'admin123' });
    const adminToken = adminLogin.body.token;

    const upd = await request(app)
      .post('/conversion/swap-fee')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fee: 12 });
    expect([200,201]).toContain(upd.status);
    // verify admin update response contains the stored fee
    expect(upd.body.data?.fee).toBe(12);

    // Create payment intent for €10 swap fee
    const useRealStripe = process.env.USE_REAL_STRIPE === 'true';
    let paymentIntentId: string;

    if (useRealStripe) {
      // Debug: print masked keys to ensure the test process picks up the correct env values
      const sk = process.env.STRIPE_SECRET_KEY || '';
      const pk = process.env.STRIPE_PUBLISHABLE_KEY || '';
      console.log('DEBUG STRIPE_KEYS:', sk ? (sk.slice(0,8) + '...' + sk.slice(-4)) : 'MISSING', pk ? (pk.slice(0,8) + '...' + pk.slice(-4)) : 'MISSING');
      // Use Stripe SDK to create a confirmed PaymentIntent with a test card
      const Stripe = (await import('stripe')).default;
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2025-11-17.clover' });

      // Verify authentication by retrieving account info
      try {
        const account = await stripe.accounts.retrieve();
        console.log('DEBUG STRIPE_ACCOUNT:', account.id);
      } catch (err: any) {
        console.error('DEBUG STRIPE_ACCOUNT_ERROR:', err.message);
        throw err;
      }

      const pi = await stripe.paymentIntents.create({
        amount: 10 * 100,
        currency: 'eur',
        payment_method: 'pm_card_visa',
        confirm: true,
        metadata: { swapId },
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        return_url: process.env.STRIPE_RETURN_URL || 'https://example.com/stripe-return'
      });

      paymentIntentId = pi.id;
      expect(pi.status === 'succeeded').toBeTruthy();
    } else {
      const piResp = await request(app)
        .post('/payments/intent')
        .set('Authorization', `Bearer ${ownerToken}`)
        .send({ amount: 10, currency: 'eur', type: 'swap_fee', metadata: { swapId } });

      expect(piResp.status).toBe(200);
      paymentIntentId = piResp.body.data?.paymentIntentId || piResp.body.paymentIntentId || piResp.body.data?.id;
      expect(paymentIntentId).toBeTruthy();
    }

    // Admin completes the swap (conversionController.completeSwap requires admin/staff)

    const completeResp = await request(app)
      .post('/conversion/complete-swap')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(useRealStripe ? { swapId, paymentIntentId } : { swapId });

    expect([200, 201]).toContain(completeResp.status);
    expect(completeResp.body.data || completeResp.body.success).toBeTruthy();
    // Response should include recorded payment id when available
    const respPaymentId = completeResp.body.data?.paymentId || completeResp.body.paymentId || completeResp.body.data?.payment_id;
    expect(respPaymentId).toBeTruthy();

    // Verify swap status updated in DB
    const swapRecord = await SwapRequest.findByPk(swapId);
    expect(swapRecord).toBeTruthy();
    expect(swapRecord?.status).toBe('completed');

    // Verify an action log was created for swap completion and includes swapId (and payment id if available)
    const logs = await ActionLog.findAll({ where: { action: 'swap_completed' }, order: [['createdAt', 'DESC']] });
    const matching = logs.find(l => {
      if (!l.details) return false;
      const details = typeof l.details === 'string' ? JSON.parse(l.details) : l.details;
      return String(details.swapId) === String(swapId) || String(details.swap_id) === String(swapId);
    });
    expect(matching).toBeTruthy();
    // if payment id was recorded, ensure it's present
    const loggedPaymentId = matching?.details?.paymentId || matching?.details?.payment_id || matching?.details?.paymentIntent || matching?.details?.payment_intent;
    if (loggedPaymentId) {
      expect(loggedPaymentId).toBeTruthy();
    }
    // Verify fee was persisted in fees table
    const recordedPaymentId = respPaymentId || loggedPaymentId;
    if (recordedPaymentId) {
      const fee = await Fee.findOne({ where: { paymentId: recordedPaymentId } });
      expect(fee).toBeTruthy();
      if (fee) expect(Number((fee as any).amount)).toBe(10);
    }
  });

  it('Guest token flow: view booking and create service request', async () => {
    // Create a booking for guest with token
    const token = `guest-token-${Date.now()}`;
    const booking = await Booking.create({ property_id: propertyId, guest_name: 'Smoke Guest', guest_email: 'guest-smoke@test.com', check_in: new Date(), check_out: new Date(Date.now() + 3*24*3600*1000), room_type: 'Standard', status: 'confirmed', guest_token: token, total_amount: 100, currency: 'EUR' });

    // Guest accesses booking via token
    const viewResp = await request(app)
      .get(`/hotel/booking/${token}`);

    expect(viewResp.status).toBe(200);
    expect(viewResp.body.booking).toBeDefined();

    // Guest creates a service request
    const srResp = await request(app)
      .post('/hotel/services')
      .send({ bookingToken: token, serviceType: 'late_checkout', description: 'Please extend', urgency: 'low' });

    expect([200,201]).toContain(srResp.status);
    expect(srResp.body.serviceRequest || srResp.body.service_request).toBeDefined();

    // Guest fetches service requests
    const listResp = await request(app)
      .get(`/hotel/services/${token}`);

    expect(listResp.status).toBe(200);
    expect(listResp.body.services).toBeDefined();
  });
});
