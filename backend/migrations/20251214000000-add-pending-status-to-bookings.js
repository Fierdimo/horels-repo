'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Add 'pending' to the status enum
    // This requires recreating the enum type in PostgreSQL or altering the column in MySQL
    
    // For MySQL/MariaDB
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled') 
      DEFAULT 'pending'
    `);
  },

  async down(queryInterface, Sequelize) {
    // Revert to original enum without 'pending'
    await queryInterface.sequelize.query(`
      ALTER TABLE bookings 
      MODIFY COLUMN status ENUM('confirmed', 'checked_in', 'checked_out', 'cancelled') 
      DEFAULT 'confirmed'
    `);
  }
};
