'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Use INSERT IGNORE (or ON DUPLICATE KEY) so seeding is idempotent and won't fail when roles exist
    await queryInterface.sequelize.query(`
      INSERT IGNORE INTO roles (name, createdAt, updatedAt) VALUES
      ('guest', NOW(), NOW()),
      ('owner', NOW(), NOW()),
      ('staff', NOW(), NOW()),
      ('admin', NOW(), NOW())
    `);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('roles', null, {});
  }
};
