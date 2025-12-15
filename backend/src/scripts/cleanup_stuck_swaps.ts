import { Op } from 'sequelize';
import SwapRequest from '../models/SwapRequest';
import sequelize from '../config/database';

/**
 * Cleanup job: finds swaps stuck in 'processing' for more than 30 minutes and marks them as 'failed'.
 * Optionally, logs or notifies about the cleanup.
 */
export async function cleanupStuckSwaps({ olderThanMinutes = 30 } = {}) {
  const threshold = new Date(Date.now() - olderThanMinutes * 60 * 1000);
  const stuckSwaps = await SwapRequest.findAll({
    where: {
      status: 'processing',
      updated_at: { [Op.lt]: threshold },
    },
  });

  if (stuckSwaps.length === 0) {
    console.log('[Cleanup] No stuck swaps found.');
    return 0;
  }

  for (const swap of stuckSwaps) {
    await swap.update({ status: 'cancelled', notes: swap.notes ? `${swap.notes}\n\n[Auto-cleanup: stuck in processing]` : '[Auto-cleanup: stuck in processing]' });
    console.log(`[Cleanup] Marked swap ${swap.id} as cancelled (was stuck since ${swap.updated_at})`);
  }
  return stuckSwaps.length;
}

// Standalone script usage
if (require.main === module) {
  sequelize.authenticate().then(async () => {
    const count = await cleanupStuckSwaps();
    console.log(`[Cleanup] Total swaps cleaned: ${count}`);
    process.exit(0);
  }).catch((err) => {
    console.error('Cleanup failed:', err);
    process.exit(1);
  });
}
