'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'pending_swap' to the bookings status ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending_swap') 
      DEFAULT 'confirmed'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove 'pending_swap' from the bookings status ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('confirmed', 'checked_in', 'checked_out', 'cancelled') 
      DEFAULT 'confirmed'
    `);
  }
};
