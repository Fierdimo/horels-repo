'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('bookings', 'payment_method', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Payment method: STRIPE, CREDITS, HYBRID, P2P_SWAP',
      after: 'payment_status'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('bookings', 'payment_method');
  }
};
