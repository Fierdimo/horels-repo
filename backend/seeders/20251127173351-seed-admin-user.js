'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('admin123', 10); // Cambiar a password seguro
    // Remove any existing admin user to make seeder idempotent
    await queryInterface.bulkDelete('users', { email: 'admin@sw2.com' }, {});

    await queryInterface.sequelize.query(`
      INSERT INTO users (email, password, role_id, status, createdAt, updatedAt)
      SELECT 'admin@sw2.com', '${hashedPassword}', r.id, 'approved', NOW(), NOW()
      FROM roles r
      WHERE r.name = 'admin'
    `);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', { email: 'admin@sw2.com' }, {});
  }
};
