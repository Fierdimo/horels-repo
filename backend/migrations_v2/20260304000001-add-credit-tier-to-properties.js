'use strict';

/**
 * Migration: Add credit tier configuration columns to timeshare_properties
 *
 * Adds:
 *   - tier: ENUM('DIAMOND','GOLD','SILVER_PLUS','STANDARD') — property category
 *   - location_multiplier: DECIMAL(4,2) — geographic premium factor (e.g. 1.20)
 *
 * These are used by CreditCalculationService in the Master Formula:
 *   Credits = BASE_SEASON × TIER_MULTIPLIER[tier] × location_multiplier × ROOM_MULTIPLIER
 */
module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('timeshare_properties', 'tier', {
      type: Sequelize.ENUM('DIAMOND', 'GOLD', 'SILVER_PLUS', 'STANDARD'),
      allowNull: false,
      defaultValue: 'STANDARD',
      after: 'is_marketplace_enabled',
      comment: 'Property credit tier (affects deposit/booking credit values)',
    });

    await queryInterface.addColumn('timeshare_properties', 'location_multiplier', {
      type: Sequelize.DECIMAL(4, 2),
      allowNull: false,
      defaultValue: 1.00,
      after: 'tier',
      comment: 'Geographic premium factor (1.00 = no premium)',
    });
  },

  down: async (queryInterface) => {
    await queryInterface.removeColumn('timeshare_properties', 'location_multiplier');
    await queryInterface.removeColumn('timeshare_properties', 'tier');
  },
};
