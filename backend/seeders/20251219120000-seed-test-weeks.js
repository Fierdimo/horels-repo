'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get test property and rooms with colors assigned
    const [properties] = await queryInterface.sequelize.query(`
      SELECT id FROM properties WHERE status = 'active' LIMIT 1
    `);

    if (properties.length === 0) {
      console.log('No active properties found. Skipping test data seeding.');
      return;
    }

    const propertyId = properties[0].id;

    // Get rooms and assign colors if they don't have any
    const [rooms] = await queryInterface.sequelize.query(`
      SELECT id, color FROM rooms WHERE property_id = ? LIMIT 3
    `, { replacements: [propertyId] });

    if (rooms.length === 0) {
      console.log(`No rooms found for property ${propertyId}. Skipping test data seeding.`);
      return;
    }

    // Assign colors to rooms if they don't have colors
    for (let i = 0; i < rooms.length; i++) {
      const colors = ['red', 'blue', 'white'];
      if (!rooms[i].color) {
        await queryInterface.sequelize.query(`
          UPDATE rooms SET color = ? WHERE id = ?
        `, { replacements: [colors[i], rooms[i].id] });
      }
    }

    // Get test owner or create one
    const [owners] = await queryInterface.sequelize.query(`
      SELECT u.id FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'owner' AND u.status = 'approved'
      LIMIT 1
    `);

    if (owners.length === 0) {
      console.log('No approved owner found. Creating test owner...');
      // Create a test owner user
      const bcrypt = require('bcryptjs');
      const hashedPassword = bcrypt.hashSync('TestOwner123!', 10);
      
      await queryInterface.sequelize.query(`
        INSERT INTO users (email, first_name, last_name, password_hash, role_id, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())
      `, { 
        replacements: ['testowner@example.com', 'Test', 'Owner', hashedPassword, 2, 'approved']
      });

      const [newOwners] = await queryInterface.sequelize.query(`
        SELECT id FROM users WHERE email = 'testowner@example.com'
      `);
      if (newOwners.length > 0) {
        owners[0] = newOwners[0];
      }
    }

    if (!owners[0]) {
      console.log('Could not find or create owner. Skipping seeding.');
      return;
    }

    const ownerId = owners[0].id;

    // Create test weeks based on rooms' colors
    const weeks = [];
    const colors = ['red', 'blue', 'white'];
    
    for (let i = 0; i < Math.min(rooms.length, 3); i++) {
      const room = rooms[i];
      const color = room.color || colors[i];
      
      weeks.push({
        owner_id: ownerId,
        property_id: propertyId,
        start_date: new Date(`2025-0${i + 1}-01`),
        end_date: new Date(`2025-0${i + 1}-08`),
        color: color,
        status: 'available',
        created_at: new Date(),
        updated_at: new Date()
      });
    }

    // Delete existing weeks for this owner
    await queryInterface.bulkDelete('weeks', { owner_id: ownerId }, {});

    // Insert new weeks
    if (weeks.length > 0) {
      await queryInterface.bulkInsert('weeks', weeks);
      console.log(`✅ Created ${weeks.length} test weeks with colors for testing swaps`);
    }
  },

  async down(queryInterface, Sequelize) {
    // Delete test weeks created by this seeder
    await queryInterface.sequelize.query(`
      DELETE FROM weeks WHERE owner_id IN (
        SELECT u.id FROM users u WHERE u.email = 'testowner@example.com'
      )
    `);
  }
};
