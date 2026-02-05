'use strict';
const bcrypt = require('bcryptjs');

/**
 * V2 Seeder: Create admin user
 * Uses role ENUM directly (no roles table dependency)
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    // Remove any existing admin user to make seeder idempotent
    await queryInterface.bulkDelete('users', { email: 'admin@sw2.com' }, {});

    // Create admin user with V2 structure
    await queryInterface.bulkInsert('users', [
      {
        email: 'admin@sw2.com',
        password_hash: hashedPassword,
        first_name: 'Admin',
        last_name: 'System',
        role: 'admin',
        status: 'approved',
        email_verified: true,
        email_verified_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);

    console.log('✅ V2 Admin user seeded: admin@sw2.com / admin123');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', { email: 'admin@sw2.com' }, {});
  }
};
