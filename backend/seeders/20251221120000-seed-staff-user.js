'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('staff123', 10);
    
    // Remove any existing staff user to make seeder idempotent
    await queryInterface.bulkDelete('users', { email: 'staff@test.com' }, {});

    // Get staff role id
    const staffRole = await queryInterface.sequelize.query(`
      SELECT id FROM roles WHERE name = 'staff' LIMIT 1
    `, { type: Sequelize.QueryTypes.SELECT });

    if (!staffRole || staffRole.length === 0) {
      throw new Error('Staff role not found');
    }

    // Get first property id
    const property = await queryInterface.sequelize.query(`
      SELECT id FROM properties LIMIT 1
    `, { type: Sequelize.QueryTypes.SELECT });

    if (!property || property.length === 0) {
      throw new Error('No properties found. Please seed properties first.');
    }

    await queryInterface.bulkInsert('users', [
      {
        email: 'staff@test.com',
        password: hashedPassword,
        role_id: staffRole[0].id,
        property_id: property[0].id,
        first_name: 'Staff',
        last_name: 'Test',
        status: 'approved',
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ]);

    console.log('✅ Staff user created: staff@test.com (password: staff123)');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', { email: 'staff@test.com' }, {});
  }
};
