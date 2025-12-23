'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'pending_swap' to the weeks status ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE weeks 
      MODIFY COLUMN status ENUM('available', 'confirmed', 'converted', 'used', 'pending_swap') 
      DEFAULT 'available'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove 'pending_swap' from the weeks status ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE weeks 
      MODIFY COLUMN status ENUM('available', 'confirmed', 'converted', 'used') 
      DEFAULT 'available'
    `);
  }
};
