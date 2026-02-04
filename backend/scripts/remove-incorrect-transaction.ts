/**
 * Script to remove incorrect transaction and fix balance
 * Removes the 500 credit transaction and leaves only the correct 140 credit one
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import CreditAccount from '../src/models/v2/CreditAccount';
import CreditTransaction from '../src/models/v2/CreditTransaction';

// Initialize models
initV2Models(sequelize);

async function fixIncorrectTransaction() {
  const transaction = await sequelize.transaction();
  
  try {
    console.log('🔧 Removing incorrect 500 credit transaction...\n');

    const account = await CreditAccount.findOne({
      where: { user_id: 10 }
    });

    if (!account) {
      console.log('❌ No account found');
      return;
    }

    console.log('📊 Current Status:');
    console.log(`   - Balance: ${account.balance}`);
    console.log(`   - Total Earned: ${account.total_earned}\n`);

    // Find and delete the incorrect transaction (500 credits)
    const incorrectTx = await CreditTransaction.findOne({
      where: {
        account_id: account.id,
        amount: 500,
        type: 'WEEK_RELEASE'
      },
      order: [['created_at', 'DESC']]
    });

    if (!incorrectTx) {
      console.log('❌ Incorrect transaction not found');
      return;
    }

    console.log('🗑️ Deleting transaction:');
    console.log(`   - ID: ${incorrectTx.id}`);
    console.log(`   - Amount: ${incorrectTx.amount}`);
    console.log(`   - Description: ${incorrectTx.description}\n`);

    // Delete the transaction
    await incorrectTx.destroy({ transaction });

    // Update account balance back to 140
    await account.update({
      balance: 140,
      total_earned: 140
    }, { transaction });

    await transaction.commit();

    console.log('✅ Successfully fixed!');
    console.log(`   - New Balance: 140`);
    console.log(`   - New Total Earned: 140`);

  } catch (error) {
    await transaction.rollback();
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

fixIncorrectTransaction()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
