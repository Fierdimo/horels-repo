/**
 * Script to check details of week allocations and their units
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import { WeekAllocation, Ownership, TimeshareUnit } from '../src/models/v2';

// Initialize models
initV2Models(sequelize);

async function checkWeekDetails() {
  try {
    const weekIds = [19, 20];
    
    for (const weekId of weekIds) {
      console.log(`\n📊 Week #${weekId}:`);
      
      const week = await WeekAllocation.findByPk(weekId, {
        include: [{
          model: Ownership,
          as: 'ownership',
          include: [{
            model: TimeshareUnit,
            as: 'unit'
          }]
        }]
      });

      if (!week) {
        console.log('   ❌ Not found');
        continue;
      }

      const unit = (week as any).ownership?.unit;
      
      console.log(`   - Week Number: ${week.week_number}`);
      console.log(`   - Year: ${week.year}`);
      console.log(`   - Dates: ${week.start_date} to ${week.end_date}`);
      console.log(`   - Status: ${week.status}`);
      console.log(`   - Unit ID: ${unit?.id}`);
      console.log(`   - Unit Category: ${unit?.category}`);
      console.log(`   - Base Credit Value: ${unit?.base_credit_value}`);
      
      if (week.release_credit_calc) {
        console.log(`   - Credit Calculation:`);
        const calc = week.release_credit_calc as any;
        console.log(`     - Base: ${calc.baseValue}`);
        console.log(`     - Seasonal: ${calc.seasonalMultiplier}x`);
        console.log(`     - Timing: ${calc.timingMultiplier}x`);
        console.log(`     - Final: ${calc.finalCredits}`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

checkWeekDetails()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
