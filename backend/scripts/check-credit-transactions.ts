/**
 * Script to check credit transactions for a specific user
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import CreditAccount from '../src/models/v2/CreditAccount';
import CreditTransaction from '../src/models/v2/CreditTransaction';

// Initialize models
initV2Models(sequelize);

async function checkTransactions(userId: number) {
  try {
    console.log(`🔍 Checking transactions for user ${userId}...\n`);

    // Get account
    const account = await CreditAccount.findOne({
      where: { user_id: userId }
    });

    if (!account) {
      console.log('❌ No credit account found for this user');
      return;
    }

    console.log(`📊 Account Info:`);
    console.log(`   - Balance: ${account.balance}`);
    console.log(`   - Total Earned: ${account.total_earned}`);
    console.log(`   - Total Spent: ${account.total_spent}`);
    console.log(`   - Total Expired: ${account.total_expired}\n`);

    // Get all transactions
    const transactions = await CreditTransaction.findAll({
      where: { account_id: account.id },
      order: [['created_at', 'ASC']]
    });

    console.log(`📋 Found ${transactions.length} transactions:\n`);

    for (const tx of transactions) {
      console.log(`Transaction #${tx.id}:`);
      console.log(`   - Type: ${tx.type}`);
      console.log(`   - Amount: ${tx.amount}`);
      console.log(`   - Description: ${tx.description}`);
      console.log(`   - Balance Before: ${tx.balance_before}`);
      console.log(`   - Balance After: ${tx.balance_after}`);
      console.log(`   - Reference: ${tx.reference_type} #${tx.reference_id}`);
      console.log(`   - Created: ${tx.created_at}\n`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

// Get user ID from command line or use default
const userId = parseInt(process.argv[2]) || 10;

checkTransactions(userId)
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
