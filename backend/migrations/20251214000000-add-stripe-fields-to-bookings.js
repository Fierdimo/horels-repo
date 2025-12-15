'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('bookings');

    // Solo agregar payment_intent_id si no existe
    if (!tableDescription.payment_intent_id) {
      await queryInterface.addColumn('bookings', 'payment_intent_id', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'payment_reference'
      });
    }

    // Solo agregar payment_status si no existe
    if (!tableDescription.payment_status) {
      await queryInterface.addColumn('bookings', 'payment_status', {
        type: Sequelize.ENUM('pending', 'processing', 'paid', 'failed', 'refunded'),
        allowNull: true,
        defaultValue: 'pending',
        after: 'payment_intent_id'
      });
    }

    // Solo agregar guest_phone si no existe
    if (!tableDescription.guest_phone) {
      await queryInterface.addColumn('bookings', 'guest_phone', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'guest_email'
      });
    }

    // Agregar índice para búsquedas rápidas por payment_intent_id (si no existe)
    const indexes = await queryInterface.showIndex('bookings');
    const indexExists = indexes.some(index => index.name === 'bookings_payment_intent_id');
    
    if (!indexExists && tableDescription.payment_intent_id) {
      await queryInterface.addIndex('bookings', ['payment_intent_id'], {
        name: 'bookings_payment_intent_id'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('bookings', 'bookings_payment_intent_id');
    await queryInterface.removeColumn('bookings', 'guest_phone');
    await queryInterface.removeColumn('bookings', 'payment_status');
    await queryInterface.removeColumn('bookings', 'payment_intent_id');
  }
};
