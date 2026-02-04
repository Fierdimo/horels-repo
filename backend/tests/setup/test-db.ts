import { Sequelize } from 'sequelize';
import { beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import { initV2Models } from '../../src/models/v2';

let sequelize: Sequelize;

/**
 * Setup database connection for each test file
 * Runs BEFORE each test file
 */
beforeAll(async () => {
  sequelize = new Sequelize({
    dialect: 'mariadb',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: 'sw2_db',
    username: process.env.DB_USERNAME || 'sw2_user',
    password: process.env.DB_PASSWORD || 'sw2_password',
    logging: false,
  });

  // Initialize V2 models
  initV2Models(sequelize);

  await sequelize.authenticate();
  console.log('Test database connection established successfully.');
});

/**
 * Close database connection after each test file
 * Runs AFTER each test file
 */
afterAll(async () => {
  if (sequelize) {
    await sequelize.close();
  }
});

/**
 * Clean database before each test
 * Uses transactions for isolation
 */
beforeEach(async () => {
  // Truncate all V2 tables in reverse FK order
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
  
  await sequelize.query('TRUNCATE TABLE v2_bookings');
  await sequelize.query('TRUNCATE TABLE hotel_inventory');
  await sequelize.query('TRUNCATE TABLE credit_transactions');
  await sequelize.query('TRUNCATE TABLE credit_accounts');
  await sequelize.query('TRUNCATE TABLE week_allocations');
  await sequelize.query('TRUNCATE TABLE ownerships');
  await sequelize.query('TRUNCATE TABLE timeshare_units');
  await sequelize.query('TRUNCATE TABLE timeshare_properties');
  await sequelize.query('TRUNCATE TABLE users');
  
  await sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
});

/**
 * Optional: Clean after each test
 * (beforeEach already cleans before next test)
 */
afterEach(async () => {
  // Optional additional cleanup
});

// Export for use in tests
export { sequelize };
