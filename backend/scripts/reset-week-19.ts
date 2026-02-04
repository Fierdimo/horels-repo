/**
 * Script to reset week allocation #19 back to ASSIGNED status
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import { WeekAllocation } from '../src/models/v2';

// Initialize models
initV2Models(sequelize);

async function resetWeek() {
  try {
    console.log('🔄 Resetting week #19...\n');

    const week = await WeekAllocation.findByPk(19);

    if (!week) {
      console.log('❌ Week not found');
      return;
    }

    console.log('📊 Current Status:');
    console.log(`   - Week: ${week.week_number}, ${week.year}`);
    console.log(`   - Status: ${week.status}\n`);

    await week.update({
      status: 'ASSIGNED',
      released_at: null,
      release_credit_calc: null
    });

    console.log('✅ Week reset to ASSIGNED status');

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

resetWeek()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
