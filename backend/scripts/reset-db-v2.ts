/**
 * V2 Database Reset Script
 * 
 * ⚠️ DEVELOPMENT ONLY! ⚠️
 * Drops all V2 tables and recreates them from migrations_v2
 * 
 * Usage:
 *   npm run db:reset:v2
 */

import { Sequelize } from 'sequelize';
import * as dotenv from 'dotenv';

dotenv.config();

const sequelize = new Sequelize({
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'sw2_db',
  username: process.env.DB_USER || 'sw2_user',
  password: process.env.DB_PASSWORD || 'sw2_password',
  dialect: 'mariadb',
  logging: console.log
});

const V2_TABLES = [
  'hotel_inventory',
  'v2_bookings',
  'credit_transactions',
  'credit_accounts',
  'week_allocations',
  'ownerships',
  'timeshare_units',
  'timeshare_properties'
  // users table is NOT dropped (shared with V1)
];

async function resetV2Database() {
  try {
    console.log('🔍 Connecting to database...');
    await sequelize.authenticate();
    console.log('✅ Database connection established\n');

    // Disable foreign key checks
    console.log('⚠️  Disabling foreign key checks...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 0;');

    // Drop V2 tables in reverse order
    console.log('🗑️  Dropping V2 tables...');
    for (const table of V2_TABLES) {
      try {
        await sequelize.query(`DROP TABLE IF EXISTS ${table};`);
        console.log(`   ✓ Dropped ${table}`);
      } catch (error: any) {
        console.log(`   ⚠️  Could not drop ${table}: ${error.message}`);
      }
    }

    // Re-enable foreign key checks
    console.log('\n✅ Re-enabling foreign key checks...');
    await sequelize.query('SET FOREIGN_KEY_CHECKS = 1;');

    console.log('\n✨ V2 tables dropped successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Run migrations: npm run migrate:v2');
    console.log('   2. Seed data: npm run seed:v2');

  } catch (error: any) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

// Confirmation prompt in dev
if (process.env.NODE_ENV === 'production') {
  console.error('❌ This script cannot run in production!');
  process.exit(1);
}

console.log('⚠️  WARNING: This will DROP all V2 tables!');
console.log('⚠️  Users table will NOT be dropped (shared)');
console.log('\nTables to drop:', V2_TABLES.join(', '));
console.log('\nStarting in 2 seconds... Press Ctrl+C to cancel\n');

setTimeout(() => {
  resetV2Database();
}, 2000);
