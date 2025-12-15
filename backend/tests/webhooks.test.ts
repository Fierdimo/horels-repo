import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import sequelize from '../src/config/database';
import ActionLog from '../src/models/ActionLog';
import User from '../src/models/User';
import jwt from 'jsonwebtoken';

// Shared mock object used by all Stripe constructor calls so the test
// can configure behavior and the app's StripeService sees the same mock.
const sharedStripeMock: any = {
  webhooks: { constructEvent: vi.fn() },
  refunds: { create: vi.fn() },
  paymentIntents: { create: vi.fn(), retrieve: vi.fn(), confirm: vi.fn(), cancel: vi.fn() },
};

// Mock Stripe module to return the shared mock instance when constructed.
vi.mock('stripe', () => ({
  default: function MockStripe() {
    return sharedStripeMock;
  },
}));

describe('Stripe webhook & refund integration', () => {
  let app: any;
  let adminToken: string;

  beforeAll(async () => {
    // start app and DB
    const appModule = await import('../src/app');
    app = appModule.default;
    await sequelize.authenticate();
    try { await sequelize.drop({ cascade: true }); } catch (e) {}
    await sequelize.sync({ force: true });

    // Ensure admin role & user exist (we synced DB so seeders may have been cleared)
    const Role = (await import('../src/models/Role')).default;
    const [adminRole] = await Role.findOrCreate({ where: { name: 'admin' }, defaults: { name: 'admin' } });
    const [adminUser] = await User.findOrCreate({ where: { email: 'admin@sw2.com' }, defaults: { email: 'admin@sw2.com', password: 'x', role_id: adminRole.id } as any });
    adminToken = jwt.sign({ id: adminUser.id, email: adminUser.email, role: 'admin' }, process.env.JWT_SECRET || 'test-secret', { expiresIn: '24h' });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('processes payment_intent.succeeded webhook and logs action', async () => {
    // Use the shared mock instance configured at the top of the file
    const mockStripe = sharedStripeMock;

    // Construct webhook event
    const webhookEvent = {
      id: 'evt_test_pi_succeeded',
      type: 'payment_intent.succeeded',
      data: {
        object: {
          id: 'pi_test_123',
          amount: 1000,
          currency: 'eur',
          metadata: { type: 'swap_fee', userId: '1' },
        },
      },
    };

    mockStripe.webhooks.constructEvent.mockReturnValue(webhookEvent);

    const res = await request(app)
      .post('/payments/webhook')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('stripe-signature', 'sig_test')
      .send({});

    expect(res.status).toBe(200);
    // Ensure constructEvent was invoked and an ActionLog entry was created
    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalled();
    const log = await ActionLog.findOne({ where: { action: 'stripe_webhook_payment_succeeded' } });
    expect(log).toBeTruthy();
  });

  it('creates a refund and logs the refund action', async () => {
    const mockStripe = sharedStripeMock;

    const mockRefund = { id: 'ref_test_1', amount: 1000, currency: 'eur', status: 'succeeded' };
    mockStripe.refunds.create.mockResolvedValue(mockRefund);

    const res = await request(app)
      .post('/payments/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentIntentId: 'pi_test_123', amount: 10, currency: 'eur', reason: 'Customer request' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Ensure refunds.create was called with expected args and log exists
    expect(mockStripe.refunds.create).toHaveBeenCalled();
    const log = await ActionLog.findOne({ where: { action: 'stripe_refund_created' } });
    expect(log).toBeTruthy();
  });

  it('rejects webhook when signature verification fails and logs the failure', async () => {
    const mockStripe = sharedStripeMock;
    const before = await ActionLog.count();

    // Simulate signature verification failure
    mockStripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    const res = await request(app)
      .post('/payments/webhook')
      .set('Authorization', `Bearer ${adminToken}`)
      .set('stripe-signature', 'bad_sig')
      .send({});

    // Expect the webhook endpoint to return a 400 for invalid signature
    expect(res.status).toBe(400);
    expect(mockStripe.webhooks.constructEvent).toHaveBeenCalled();

    const after = await ActionLog.count();
    expect(after).toBeGreaterThanOrEqual(before + 1);
  });

  it('handles refund creation failures and returns an error', async () => {
    const mockStripe = sharedStripeMock;

    // Make refunds.create reject to simulate Stripe failure
    mockStripe.refunds.create.mockRejectedValue(new Error('Stripe refund failed'));

    const res = await request(app)
      .post('/payments/refund')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ paymentIntentId: 'pi_test_123', amount: 10, currency: 'eur', reason: 'Customer request' });

    // Expect the server to respond with an error status and a failure body
    expect(res.status).toBeGreaterThanOrEqual(500);
    expect(res.body && res.body.success).not.toBe(true);
    expect(mockStripe.refunds.create).toHaveBeenCalled();
  });
});
