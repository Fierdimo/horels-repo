/**
 * Script to check week allocation history
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import { WeekAllocation, Ownership, TimeshareUnit, TimeshareProperty } from '../src/models/v2';

// Initialize models
initV2Models(sequelize);

async function checkWeekAllocations(userId: number) {
  try {
    console.log(`🔍 Checking week allocations for user ${userId}...\n`);

    // Get ownerships
    const ownerships = await Ownership.findAll({
      where: { owner_id: userId },
      include: [{
        model: TimeshareUnit,
        as: 'unit',
        include: [{
          model: TimeshareProperty,
          as: 'property'
        }]
      }]
    });

    console.log(`📊 Found ${ownerships.length} ownerships\n`);

    for (const ownership of ownerships) {
      console.log(`Ownership #${ownership.id}:`);
      console.log(`   - Type: ${ownership.type}`);
      console.log(`   - Status: ${ownership.status}`);
      console.log(`   - Unit: ${(ownership as any).unit?.name}`);
      console.log(`   - Property: ${(ownership as any).unit?.property?.name}\n`);

      // Get week allocations
      const weeks = await WeekAllocation.findAll({
        where: { ownership_id: ownership.id },
        order: [['year', 'DESC'], ['week_number', 'ASC']]
      });

      console.log(`   Weeks (${weeks.length}):`);
      for (const week of weeks) {
        console.log(`   - Week #${week.id}: Week ${week.week_number}, ${week.year}`);
        console.log(`     Status: ${week.status}`);
        console.log(`     Dates: ${week.start_date} to ${week.end_date}`);
        console.log(`     Credits Issued: ${week.credits_issued || 'N/A'}`);
        console.log(`     Released At: ${week.released_at || 'N/A'}\n`);
      }
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

checkWeekAllocations(userId)
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
