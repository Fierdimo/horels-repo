"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('bookings', 'pms_booking_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('bookings', 'pms_provider', {
      type: Sequelize.STRING,
      allowNull: true,
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('bookings', 'pms_booking_id');
    await queryInterface.removeColumn('bookings', 'pms_provider');
  }
};
