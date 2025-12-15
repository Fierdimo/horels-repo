"use strict";

module.exports = {
  async up (queryInterface, Sequelize) {
    // Guard against duplicate column errors if the column already exists
    const table = await queryInterface.describeTable('hotel_services').catch(() => ({}));
    if (!table || !table['stripe_payment_intent']) {
      await queryInterface.addColumn('hotel_services', 'stripe_payment_intent', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }

    if (!table || !table['payment_status']) {
      await queryInterface.addColumn('hotel_services', 'payment_status', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeColumn('hotel_services', 'stripe_payment_intent');
    await queryInterface.removeColumn('hotel_services', 'payment_status');
  }
};
