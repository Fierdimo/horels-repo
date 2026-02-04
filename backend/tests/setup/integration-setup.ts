import { Sequelize } from 'sequelize';

/**
 * Global setup for integration tests
 * Runs ONCE before all test suites
 */
export async function setup() {
  console.log('🔧 Integration Tests Setup - Starting...');

  const sequelize = new Sequelize({
    dialect: 'mariadb',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: 'sw2_db',
    username: process.env.DB_USERNAME || 'sw2_user',
    password: process.env.DB_PASSWORD || 'sw2_password',
    logging: false,
  });

  try {
    await sequelize.authenticate();
    console.log('✅ MariaDB connection established');
    console.log('⚠️  Assuming V2 tables exist (run npm run migrate:v2 if needed)');
    await sequelize.close();
    console.log('🚀 Integration Tests Setup - Complete\n');
  } catch (error: any) {
    console.error('❌ Integration Tests Setup - Failed:', error.message);
    await sequelize.close();
    throw error;
  }
}

/**
 * Global teardown for integration tests
 * Runs ONCE after all test suites
 */
export async function teardown() {
  console.log('\n🧹 Integration Tests Teardown - Complete');
}
