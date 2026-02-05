'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Insert permissions if missing using INSERT IGNORE to avoid duplicates
    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO permissions (name, createdAt, updatedAt) VALUES
      ('create_user', NOW(), NOW()),
      ('view_users', NOW(), NOW()),
      ('update_user', NOW(), NOW()),
      ('delete_user', NOW(), NOW()),
      ('view_bookings', NOW(), NOW()),
      ('create_booking', NOW(), NOW()),
      ('update_booking', NOW(), NOW()),
      ('cancel_booking', NOW(), NOW()),
      ('manage_bookings', NOW(), NOW()),
      ('view_availability', NOW(), NOW()),
      ('view_property', NOW(), NOW()),
      ('view_own_properties', NOW(), NOW()),
      ('manage_payments', NOW(), NOW()),
      ('view_reports', NOW(), NOW()),
      ('manage_roles', NOW(), NOW()),
      ('manage_permissions', NOW(), NOW()),
      ('view_own_weeks', NOW(), NOW())
    `);
    
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('permissions', null, {});
  }
};
