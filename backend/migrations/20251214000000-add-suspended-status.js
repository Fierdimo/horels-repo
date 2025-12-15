'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // MySQL/MariaDB: Modify ENUM to add 'suspended'
    await queryInterface.sequelize.query(
      "ALTER TABLE users MODIFY COLUMN status ENUM('pending', 'approved', 'rejected', 'suspended') NOT NULL DEFAULT 'pending'"
    );
  },

  down: async (queryInterface, Sequelize) => {
    // Revert: Remove 'suspended' from ENUM
    // WARNING: This will fail if any user has status='suspended'
    await queryInterface.sequelize.query(
      "ALTER TABLE users MODIFY COLUMN status ENUM('pending', 'approved', 'rejected') NOT NULL DEFAULT 'pending'"
    );
  }
};
