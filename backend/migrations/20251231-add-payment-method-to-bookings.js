'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Check if column exists before adding
    const tableInfo = await queryInterface.describeTable('bookings');
    if (!tableInfo.payment_method) {
      await queryInterface.addColumn('bookings', 'payment_method', {
        type: Sequelize.STRING,
        allowNull: true,
        comment: 'Payment method: STRIPE, CREDITS, HYBRID, P2P_SWAP',
        after: 'payment_status'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('bookings');
    if (tableInfo.payment_method) {
      await queryInterface.removeColumn('bookings', 'payment_method');
    }
  }
};
