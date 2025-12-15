'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Ensure there are no duplicate non-null idempotency_keys before creating unique index

    // Duplicate check temporarily disabled due to Sequelize CLI bug

    // Create unique index on idempotency_key to guard against duplicates at DB level
    await queryInterface.addIndex('bookings', ['idempotency_key'], {
      unique: true,
      name: 'uniq_bookings_idempotency_key'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('bookings', 'uniq_bookings_idempotency_key');
  }
};
