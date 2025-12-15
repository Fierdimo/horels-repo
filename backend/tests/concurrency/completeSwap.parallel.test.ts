import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import sequelize from '../../src/config/database';
import SwapRequest from '../../src/models/SwapRequest';
import Fee from '../../src/models/Fee';
import ConversionService from '../../src/services/conversionService';
import Role from '../../src/models/Role';
import User from '../../src/models/User';
import Week from '../../src/models/Week';
import Property from '../../src/models/Property';

describe('Concurrency: completeSwap', () => {
  beforeAll(async () => {
    // Ensure a clean DB for this test file
    await sequelize.sync({ force: true });
  });

  afterAll(async () => {
    await sequelize.close();
  });

  it('prevents double-processing when two completions run in parallel', async () => {
    // Create necessary entities: role, user, week
    const role = await Role.create({ name: 'owner' } as any);
    const user = await User.create({ email: 'owner1@example.com', password: 'x', role_id: role.id } as any);
    // Create property referenced by the week
    const property = await Property.create({ name: 'Test Property', location: 'Test Location' });
    const week = await Week.create({ owner_id: user.id, property_id: property.id, start_date: new Date(), end_date: new Date(Date.now() + 7 * 86400 * 1000), color: 'red' } as any);

    // Create a swap row with status 'matched' referencing the week
    const swap = await SwapRequest.create({
      requester_id: user.id,
      responder_id: user.id,
      requester_week_id: week.id,
      responder_week_id: null,
      desired_start_date: new Date(),
      desired_end_date: new Date(Date.now() + 86400 * 1000),
      status: 'matched',
      swap_fee: 10,
    } as any);

    // Mock stripe service that simulates a small delay on confirmPayment
    const mockStripe = {
      async createPaymentIntent(amount: number) {
        return { paymentIntentId: `pi_mock_${Date.now()}` };
      },
      async confirmPayment(paymentIntentId: string) {
        // small delay to increase race window
        await new Promise((r) => setTimeout(r, 50));
        return { status: 'succeeded', paymentIntentId };
      },
    } as any;

    const svc = new ConversionService(mockStripe);

    // Run two parallel attempts
    const p1 = svc.completeSwap(String(swap.id)).then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e }));
    const p2 = svc.completeSwap(String(swap.id)).then((r) => ({ ok: true, r })).catch((e) => ({ ok: false, e }));

    const [res1, res2] = await Promise.all([p1, p2]);

    // Exactly one should succeed and the other should fail due to processing guard
    const successCount = [res1, res2].filter((x) => x.ok).length;
    expect(successCount).toBe(1);

    // Ensure only one Fee record was created
    const fees = await Fee.findAll({ where: { type: 'swap_fee' } });
    expect(fees.length).toBe(1);
  });
});
