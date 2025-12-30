'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'pending' back to the bookings status ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending_swap') 
      DEFAULT 'confirmed'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Remove 'pending' from the bookings status ENUM
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('confirmed', 'checked_in', 'checked_out', 'cancelled', 'pending_swap') 
      DEFAULT 'confirmed'
    `);
  }
};
