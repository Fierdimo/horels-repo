/**
 * Script to recalculate credit account totals
 * 
 * This script recalculates total_earned, total_spent, and total_expired
 * for all credit accounts based on existing transactions.
 * 
 * Run with: npx ts-node scripts/recalculate-credit-totals.ts
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import CreditAccount from '../src/models/v2/CreditAccount';
import CreditTransaction from '../src/models/v2/CreditTransaction';

// Initialize models
initV2Models(sequelize);

async function recalculateTotals() {
  try {
    console.log('🔄 Starting credit totals recalculation...\n');

    // Get all credit accounts
    const accounts = await CreditAccount.findAll();
    
    console.log(`📊 Found ${accounts.length} credit accounts\n`);

    let updatedCount = 0;

    for (const account of accounts) {
      // Get all transactions for this account
      const transactions = await CreditTransaction.findAll({
        where: { account_id: account.id },
        order: [['created_at', 'ASC']]
      });

      // Calculate totals
      let total_earned = 0;
      let total_spent = 0;
      let total_expired = 0;

      for (const tx of transactions) {
        const amount = parseFloat(tx.amount.toString());
        
        if (amount > 0) {
          // Positive amount = earned
          total_earned += amount;
        } else if (amount < 0) {
          // Negative amount = spent or expired
          if (tx.type === 'CREDIT_EXPIRATION') {
            total_expired += Math.abs(amount);
          } else {
            total_spent += Math.abs(amount);
          }
        }
      }

      // Update account
      await account.update({
        total_earned,
        total_spent,
        total_expired
      });

      console.log(`✅ Account ${account.id} (User ${account.user_id}):`);
      console.log(`   - Earned: ${total_earned}`);
      console.log(`   - Spent: ${total_spent}`);
      console.log(`   - Expired: ${total_expired}`);
      console.log(`   - Balance: ${account.balance}\n`);

      updatedCount++;
    }

    console.log(`\n✅ Successfully recalculated totals for ${updatedCount} accounts`);
    
  } catch (error) {
    console.error('❌ Error recalculating totals:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Run the script
recalculateTotals()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
