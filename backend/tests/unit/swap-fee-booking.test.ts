import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import sequelize from '../../src/config/database';
import ConversionService from '../../src/services/conversionService';
import Fee from '../../src/models/Fee';

// Mock StripeService with controlled responses
class MockStripeService {
  async createPaymentIntent(amount: number, currency: string, metadataType: string, metadata: any) {
    return { paymentIntentId: 'pi_test_123' };
  }

  async confirmPayment(paymentIntentId: string) {
    return { status: 'succeeded', paymentIntentId, chargeId: 'ch_test_987' };
  }
}

// Simple in-memory swap model to satisfy findByPk and update calls
class InMemorySwapModel {
  private store: Record<string, any> = {};

  async create(data: any) {
    const id = data.id || `swap_${Date.now()}`;
    this.store[id] = { id, ...data };
    return this.store[id];
  }

  async findByPk(id: string) {
    const s = this.store[id];
    if (!s) return null;
    // Provide update that mutates the in-memory object
    return {
      ...s,
      update: async (patch: any) => { Object.assign(this.store[id], patch); return this.store[id]; },
      // include requester_id alias used by service
      requester_id: s.requester_id || s.guestId || 1,
    };
  }
}

describe('ConversionService - swap fee persistence with booking link', () => {
  beforeAll(async () => {
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('records fee with booking_id and stripeChargeId when provided', async () => {
    const mockStripe = new MockStripeService();
    const swapModel = new InMemorySwapModel();

    // Create a mock swap record in memory
    const swap = await swapModel.create({ id: 'swap_test_1', status: 'matched', requester_id: 42 });

    const conversionService = new ConversionService(mockStripe as any, swapModel as any, undefined);

    // run completeSwap with a bookingId param — expect it to persist a Fee row with booking and charge
    const res = await conversionService.completeSwap('swap_test_1', undefined, 12345);

    expect(res).toHaveProperty('success', true);

    // Find the fee recorded for the payment intent
    const fee = await Fee.findOne({ where: { payment_id: 'pi_test_123' } } as any);
    expect(fee).toBeTruthy();
    // Fee model fields (underscored column names) map to JS keys by model definition
    // Check bookingId and stripeChargeId persisted
    expect((fee as any).bookingId === 12345 || (fee as any).booking_id === 12345).toBeTruthy();
    expect((fee as any).stripeChargeId === 'ch_test_987' || (fee as any).stripe_charge_id === 'ch_test_987').toBeTruthy();
  }, 20000);
});
