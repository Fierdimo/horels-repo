'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'stripe_payment_method_id', {
      type: Sequelize.STRING,
      allowNull: true,
      comment: 'Default Stripe payment method ID'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('users', 'stripe_payment_method_id');
  }
};
