/**
 * Credit Expiration Worker
 * 
 * Scheduled job that runs daily to expire old credits.
 * Marks credits as expired when they reach their expiration date.
 */

import cron from 'node-cron';
import CreditWalletService from '../services/CreditWalletService';

/**
 * Run credit expiration job
 * This function is called by the cron scheduler
 */
async function runCreditExpiration() {
  const startTime = Date.now();
  console.log('[CreditExpiration] Starting credit expiration job...');
  
  try {
    const result = await CreditWalletService.expireCredits();
    
    const duration = Date.now() - startTime;
    console.log(`[CreditExpiration] Job completed in ${duration}ms`);
    console.log(`[CreditExpiration] Results:`, {
      expiredCount: result.expiredCount,
      totalCreditsExpired: result.totalCreditsExpired
    });
    
    return result;
  } catch (error) {
    console.error('[CreditExpiration] Job failed:', error);
    throw error;
  }
}

/**
 * Schedule credit expiration job
 * Runs every day at 2:00 AM UTC
 * 
 * Cron expression: '0 2 * * *'
 * - Minute: 0
 * - Hour: 2 (2 AM)
 * - Day of Month: * (every day)
 * - Month: * (every month)
 * - Day of Week: * (every day of week)
 */
export function scheduleCreditExpiration() {
  console.log('[CreditExpiration] Scheduling daily credit expiration job (2:00 AM UTC)...');
  
  // Run at 2:00 AM every day
  const task = cron.schedule('0 2 * * *', async () => {
    try {
      await runCreditExpiration();
    } catch (error) {
      console.error('[CreditExpiration] Scheduled job error:', error);
    }
  }, {
    timezone: 'UTC'
  });

  console.log('[CreditExpiration] Job scheduled successfully');
  
  return task;
}

/**
 * Run credit expiration immediately (for manual execution)
 * Can be called from admin endpoint or during server startup
 */
export async function runCreditExpirationNow() {
  console.log('[CreditExpiration] Running credit expiration manually...');
  return await runCreditExpiration();
}

/**
 * Initialize credit expiration worker
 * Called during server startup
 */
export function initCreditExpirationWorker() {
  console.log('[CreditExpiration] Initializing credit expiration worker...');
  
  // Schedule the recurring job
  const task = scheduleCreditExpiration();
  
  // Optionally run once at startup (uncomment if needed)
  // runCreditExpirationNow().catch(error => {
  //   console.error('[CreditExpiration] Initial run failed:', error);
  // });
  
  return task;
}

export default {
  initCreditExpirationWorker,
  scheduleCreditExpiration,
  runCreditExpirationNow,
  runCreditExpiration
};
