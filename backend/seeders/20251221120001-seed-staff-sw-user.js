'use strict';
const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const hashedPassword = await bcrypt.hash('staff123', 10);
    
    // Remove any existing staff user to make seeder idempotent
    await queryInterface.bulkDelete('users', { email: 'staff@sw.com' }, {});

    // Get staff role id
    const staffRole = await queryInterface.sequelize.query(`
      SELECT id FROM roles WHERE name = 'staff' LIMIT 1
    `, { type: Sequelize.QueryTypes.SELECT });

    if (!staffRole || staffRole.length === 0) {
      throw new Error('Staff role not found');
    }

    // Get or create "test" property
    let property = await queryInterface.sequelize.query(`
      SELECT id FROM properties WHERE name = 'test' LIMIT 1
    `, { type: Sequelize.QueryTypes.SELECT });

    if (!property || property.length === 0) {
      // Create test property if it doesn't exist using raw SQL
      await queryInterface.sequelize.query(`
        INSERT INTO properties (name, location, created_at, updated_at)
        VALUES ('test', 'Test Location', NOW(), NOW())
      `);

      property = await queryInterface.sequelize.query(`
        SELECT id FROM properties WHERE name = 'test' LIMIT 1
      `, { type: Sequelize.QueryTypes.SELECT });
    }

    if (!property || property.length === 0) {
      throw new Error('Failed to create or find test property');
    }

    await queryInterface.bulkInsert('users', [
      {
        email: 'staff@sw.com',
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

    console.log('✅ Staff user created: staff@sw.com (password: staff123) assigned to "test" hotel');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('users', { email: 'staff@sw.com' }, {});
  }
};
