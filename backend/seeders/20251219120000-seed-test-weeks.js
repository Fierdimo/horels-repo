'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get test property 
    const [properties] = await queryInterface.sequelize.query(`
      SELECT id FROM properties WHERE status = 'active' LIMIT 1
    `);

    if (properties.length === 0) {
      console.log('No active properties found. Skipping test data seeding.');
      return;
    }

    const propertyId = properties[0].id;

    // Get or create test owner
    const [owners] = await queryInterface.sequelize.query(`
      SELECT u.id FROM users u
      WHERE u.role_id = (SELECT id FROM roles WHERE name = 'owner') AND u.status = 'approved'
      LIMIT 1
    `);

    let ownerId;
    if (owners.length === 0) {
      console.log('Creating test owner...');
      // Just insert weeks with existing owner, or skip
      const [adminUsers] = await queryInterface.sequelize.query(`
        SELECT id FROM users LIMIT 1
      `);
      if (adminUsers.length === 0) {
        console.log('No users found. Skipping test weeks.');
        return;
      }
      ownerId = adminUsers[0].id;
    } else {
      ownerId = owners[0].id;
    }

    // Create 3 test weeks with different accommodation types
    const accommodationTypes = ['standard', 'deluxe', 'suite'];
    
    for (let i = 0; i < accommodationTypes.length; i++) {
      const type = accommodationTypes[i];
      const startDate = `2025-0${i + 1}-01`;
      const endDate = `2025-0${i + 1}-08`;
      
      await queryInterface.sequelize.query(`
        INSERT INTO weeks (owner_id, property_id, start_date, end_date, accommodation_type, status, created_at, updated_at)
        VALUES (${ownerId}, ${propertyId}, '${startDate}', '${endDate}', '${type}', 'available', NOW(), NOW())
      `);
    }

    console.log('✅ Created 3 test weeks with accommodation types for swap testing');
  },

  async down(queryInterface, Sequelize) {
    // Delete test weeks - simple cleanup
    await queryInterface.sequelize.query(`
      DELETE FROM weeks WHERE accommodation_type IN ('standard', 'deluxe', 'suite')
      LIMIT 3
    `);
  }
};
