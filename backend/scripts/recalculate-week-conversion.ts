/**
 * Script to check credit calculation for week 18
 */

import sequelize from '../src/config/database';
import { initV2Models } from '../src/models/v2';
import { WeekAllocation, Ownership, TimeshareUnit } from '../src/models/v2';

// Initialize models
initV2Models(sequelize);

async function checkWeekCalculation() {
  try {
    const week = await WeekAllocation.findByPk(18, {
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
      console.log('❌ Week not found');
      return;
    }

    const ownership = (week as any).ownership;
    const unit = ownership.unit;

    console.log('📊 Week Information:');
    console.log(`   - Week #${week.id}: Week ${week.week_number}, ${week.year}`);
    console.log(`   - Dates: ${week.start_date} to ${week.end_date}`);
    console.log(`   - Status: ${week.status}\n`);

    console.log('🏢 Unit Information:');
    console.log(`   - Unit: ${unit.name || unit.category}`);
    console.log(`   - Base Credit Value: ${unit.base_credit_value}`);
    console.log(`   - Room Type Multiplier: ${unit.room_type_multiplier}`);
    console.log(`   - Seasonal Factors (raw): ${unit.seasonal_factors}\n`);

    // Parse seasonal factors
    let seasonalFactors: any = {};
    if (unit.seasonal_factors) {
      try {
        // Try double parse in case it's double-encoded
        let parsed = JSON.parse(unit.seasonal_factors);
        if (typeof parsed === 'string') {
          parsed = JSON.parse(parsed);
        }
        seasonalFactors = parsed;
        console.log('✅ Seasonal Factors (parsed):', seasonalFactors);
      } catch (e) {
        console.log('❌ Failed to parse seasonal factors:', e);
      }
    }

    // Manual calculation
    const baseValue = parseFloat(unit.base_credit_value);
    const weekNum = week.week_number || 1;
    console.log(`\n💰 Manual Calculation:`);
    console.log(`   - Base Value: ${baseValue}`);
    console.log(`   - Week Number: ${weekNum}`);
    console.log(`   - Seasonal factor for week ${weekNum}: ${seasonalFactors[weekNum] || 1.0}`);
    
    // Timing penalty calculation
    const startDate = new Date(week.start_date);
    const releaseDate = new Date();
    const daysInAdvance = Math.floor((startDate.getTime() - releaseDate.getTime()) / (1000 * 60 * 60 * 24));
    console.log(`   - Days in advance: ${daysInAdvance}`);
    
    // Calculate timing multiplier
    let timingMultiplier = 1.0;
    if (daysInAdvance < 60) {
      timingMultiplier = 0.5; // 50% penalty if released within 60 days
    } else if (daysInAdvance < 90) {
      timingMultiplier = 0.75; // 25% penalty if released within 90 days
    }
    console.log(`   - Timing Multiplier: ${timingMultiplier}`);
    
    const finalCredits = Math.round(baseValue * (seasonalFactors[weekNum] || 1.0) * timingMultiplier);
    console.log(`   - Expected Final Credits: ${finalCredits}`);
    console.log(`\n   - ACTUAL Credits Issued: 500`);

  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

checkWeekCalculation()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
