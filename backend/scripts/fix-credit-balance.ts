/**
 * Script to fix incorrect credit balance for user 10
 * Corrects from 500 to 140 credits (correct calculation with timing penalty)
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import CreditAccount from '../src/models/v2/CreditAccount';
import CreditTransaction from '../src/models/v2/CreditTransaction';

// Initialize models
initV2Models(sequelize);

async function fixCreditBalance() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔧 Fixing credit balance for user 10...\n');

    // Get account
    const account = await CreditAccount.findOne({
      where: { user_id: 10 }
    });

    if (!account) {
      console.log('❌ No credit account found for user 10');
      return;
    }

    console.log('📊 Current Account Status:');
    console.log(`   - Balance: ${account.balance}`);
    console.log(`   - Total Earned: ${account.total_earned}\n`);

    // Get the transaction
    const tx = await CreditTransaction.findOne({
      where: { 
        account_id: account.id,
        type: 'WEEK_RELEASE',
        reference_id: 18
      }
    });

    if (!tx) {
      console.log('❌ Transaction not found');
      return;
    }

    console.log('📋 Current Transaction:');
    console.log(`   - Amount: ${tx.amount}`);
    console.log(`   - Balance Before: ${tx.balance_before}`);
    console.log(`   - Balance After: ${tx.balance_after}\n`);

    // Correct values
    const correctAmount = 140;
    const correctBalanceAfter = parseFloat(tx.balance_before.toString()) + correctAmount;

    console.log('✅ Correcting to:');
    console.log(`   - Amount: ${correctAmount}`);
    console.log(`   - Balance After: ${correctBalanceAfter}\n`);

    // Update transaction
    await tx.update({
      amount: correctAmount,
      balance_after: correctBalanceAfter
    }, { transaction });

    // Update account balance and totals
    await account.update({
      balance: correctBalanceAfter,
      total_earned: correctAmount
    }, { transaction });

    await transaction.commit();

    console.log('✅ Successfully corrected credit balance!');
    console.log(`   - New Balance: ${correctBalanceAfter}`);
    console.log(`   - New Total Earned: ${correctAmount}`);

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error fixing balance:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

fixCreditBalance()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
