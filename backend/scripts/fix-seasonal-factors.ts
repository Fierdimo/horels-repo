/**
 * Script to fix seasonal_factors format
 * 
 * Changes from: {"high":1.5,"medium":1,"low":0.7}
 * To proper week-based format: {"1":0.7,"2":0.7,...,"25":1.5,...,"52":0.7}
 * 
 * Assumes:
 * - Weeks 1-10: Low season (0.7)
 * - Weeks 11-20: High season (1.5) - Spring
 * - Weeks 21-35: High season (1.5) - Summer
 * - Weeks 36-45: Medium season (1.0) - Fall
 * - Weeks 46-52: Low season (0.7) - Winter
 */

import sequelize from '../src/config/database';
import { Op } from 'sequelize';
import { initV2Models } from '../src/models/v2';
import { TimeshareUnit } from '../src/models/v2';

// Initialize models
initV2Models(sequelize);

async function fixSeasonalFactors() {
  try {
    console.log('🔧 Fixing seasonal_factors format...\n');

    // Get all units with seasonal_factors
    const units = await TimeshareUnit.findAll({
      where: {
        seasonal_factors: { [Op.ne]: null }
      }
    });

    console.log(`📊 Found ${units.length} units with seasonal_factors\n`);

    let updatedCount = 0;

    for (const unit of units) {
      console.log(`Unit #${unit.id} (${unit.category}):`);
      console.log(`   Current: ${unit.seasonal_factors}`);

      // Build proper week-based seasonal factors
      const weekFactors: Record<string, number> = {};
      
      // Default seasonal pattern for Europe/Spain
      for (let week = 1; week <= 52; week++) {
        if (week <= 10 || week >= 46) {
          // Winter: Low season
          weekFactors[week.toString()] = 0.7;
        } else if (week >= 21 && week <= 35) {
          // Summer: High season
          weekFactors[week.toString()] = 1.5;
        } else if (week >= 11 && week <= 20) {
          // Spring: High season
          weekFactors[week.toString()] = 1.3;
        } else {
          // Fall: Medium season
          weekFactors[week.toString()] = 1.0;
        }
      }

      // Update unit
      await unit.update({
        seasonal_factors: JSON.stringify(weekFactors)
      });

      console.log(`   ✅ Updated to week-based format (52 weeks)\n`);
      updatedCount++;
    }

    console.log(`✅ Successfully updated ${updatedCount} units`);

  } catch (error) {
    console.error('❌ Error fixing seasonal factors:', error);
    throw error;
  } finally {
    await sequelize.close();
  }
}

fixSeasonalFactors()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
