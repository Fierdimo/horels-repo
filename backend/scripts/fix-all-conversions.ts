/**
 * Script to fix all incorrect credit conversions
 * Recalculates credits with correct seasonal factors
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import CreditAccount from '../src/models/v2/CreditAccount';
import CreditTransaction from '../src/models/v2/CreditTransaction';
import { WeekAllocation } from '../src/models/v2';

// Initialize models
initV2Models(sequelize);

async function recalculateAllConversions() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔧 Recalculating all credit conversions...\n');

    const account = await CreditAccount.findOne({
      where: { user_id: 10 }
    });

    if (!account) {
      console.log('❌ No account found');
      return;
    }

    console.log('📊 Current Account:');
    console.log(`   - Balance: ${account.balance}`);
    console.log(`   - Total Earned: ${account.total_earned}\n`);

    // Expected correct values based on calculations:
    // Week 18: 280 * 0.7 * 0.5 = 98 (PENTHOUSE, week 1)
    // Week 19: 150 * 0.7 * 0.5 = 53 (STUDIO, week 1)  
    // Week 20: 280 * 0.7 * 0.5 = 98 (PENTHOUSE, week 2)
    
    const corrections = [
      { id: 1, allocationId: 18, currentAmount: 140, correctAmount: 98 },
      { id: 3, allocationId: 19, currentAmount: 75, correctAmount: 53 },
      { id: 4, allocationId: 20, currentAmount: 140, correctAmount: 98 }
    ];

    let newBalance = 0;
    let newTotalEarned = 0;

    for (const correction of corrections) {
      const tx = await CreditTransaction.findByPk(correction.id);
      
      if (!tx) {
        console.log(`   ⚠️  Transaction ${correction.id} not found`);
        continue;
      }

      console.log(`Transaction #${correction.id} (Week ${correction.allocationId}):`);
      console.log(`   - Current: ${correction.currentAmount}`);
      console.log(`   - Correct: ${correction.correctAmount}`);

      // Update transaction
      const balanceBefore = newBalance;
      newBalance += correction.correctAmount;
      
      await tx.update({
        amount: correction.correctAmount,
        balance_before: balanceBefore,
        balance_after: newBalance
      }, { transaction });

      newTotalEarned += correction.correctAmount;
      console.log(`   ✅ Updated (new balance: ${newBalance})\n`);
    }

    // Update account
    await account.update({
      balance: newBalance,
      total_earned: newTotalEarned
    }, { transaction });

    await transaction.commit();

    console.log('✅ Successfully recalculated all conversions!');
    console.log(`   - New Balance: ${newBalance}`);
    console.log(`   - New Total Earned: ${newTotalEarned}`);
    console.log(`\n📋 Breakdown:`);
    console.log(`   - Week 18 (PENTHOUSE): 98 credits`);
    console.log(`   - Week 19 (STUDIO): 53 credits`);
    console.log(`   - Week 20 (PENTHOUSE): 98 credits`);
    console.log(`   - Total: 249 credits`);

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

recalculateAllConversions()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
