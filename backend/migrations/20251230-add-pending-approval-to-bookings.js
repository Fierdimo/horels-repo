'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'pending_approval' to the bookings status ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending_swap', 'pending_approval') 
      DEFAULT 'pending'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove 'pending_approval' from the bookings status ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending_swap') 
      DEFAULT 'pending'
    `);
  }
};
