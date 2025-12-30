'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('credit_booking_costs', 'effective_until', {
      type: Sequelize.DATEONLY,
      allowNull: true,
      comment: 'Date until which this pricing is effective (null = no expiration)',
      after: 'effective_date'
    });

    // Add index for date range queries
    await queryInterface.addIndex('credit_booking_costs', ['effective_date', 'effective_until'], {
      name: 'credit_costs_date_range_idx'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('credit_booking_costs', 'credit_costs_date_range_idx');
    await queryInterface.removeColumn('credit_booking_costs', 'effective_until');
  }
};
