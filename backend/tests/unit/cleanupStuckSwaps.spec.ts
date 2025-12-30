import { cleanupStuckSwaps } from '../../src/scripts/cleanup_stuck_swaps';
import { SwapRequest, User, Week, Property } from '../../src/models';

describe('Cleanup stuck swaps job', () => {
  it('should mark old processing swaps as failed', async () => {
    // Setup: create a property, user y week válidos para el swap
    const prop = await Property.create({ 
      name: 'Cleanup Prop', 
      location: 'Test City',
      tier: 'STANDARD',
      location_multiplier: 1.00
    });
    const user = await User.create({ email: `cleanup-test-${Date.now()}@test.com`, password: 'x', role_id: 1 });
    const week = await Week.create({ owner_id: user.id, property_id: prop.id, start_date: new Date(), end_date: new Date(Date.now() + 7*24*3600*1000), color: 'red', status: 'available' });
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
    const swap = await SwapRequest.create({
      requester_id: user.id,
      requester_week_id: week.id,
      desired_start_date: new Date(Date.now() + 8*24*3600*1000),
      desired_end_date: new Date(Date.now() + 15*24*3600*1000),
      status: 'processing',
      swap_fee: 10,
      updatedAt: oldDate,
      createdAt: oldDate,
    });

    // Run cleanup
    const cleaned = await cleanupStuckSwaps({ olderThanMinutes: 30 });
    expect(cleaned).toBeGreaterThanOrEqual(1);

    // Reload swap and check status
    const updated = await SwapRequest.findByPk(swap.id);
    expect(updated.status).toBe('failed');
    expect(updated.failureReason).toMatch(/Auto-cleanup/);

    // Cleanup
    await swap.destroy();
    await week.destroy();
    await user.destroy();
    await prop.destroy();
  });
});
