'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add columns to bookings table to persist PMS/external references and metadata
    await queryInterface.addColumn('bookings', 'payment_reference', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('bookings', 'idempotency_key', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('bookings', 'night_credit_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('bookings', 'swap_request_id', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await queryInterface.addColumn('bookings', 'raw', {
      type: Sequelize.JSON,
      allowNull: true,
    });

    // Optional: add an index for faster idempotency lookups (not unique to avoid accidental constraint issues)
    await queryInterface.addIndex('bookings', ['idempotency_key'], {
      name: 'idx_bookings_idempotency_key'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('bookings', 'idx_bookings_idempotency_key');
    await queryInterface.removeColumn('bookings', 'raw');
    await queryInterface.removeColumn('bookings', 'swap_request_id');
    await queryInterface.removeColumn('bookings', 'night_credit_id');
    await queryInterface.removeColumn('bookings', 'idempotency_key');
    await queryInterface.removeColumn('bookings', 'payment_reference');
  }
};
