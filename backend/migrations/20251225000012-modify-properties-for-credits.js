'use strict';

/**
 * Migration: Modify properties table for credit system
 * 
 * Purpose: Add tier_id and credit-related fields to properties
 * 
 * Performance Optimizations:
 * - Index on tier_id for grouped queries by tier
 * - Index on allows_credit_bookings for filtering available properties
 * 
 * Changes:
 * 1. Add tier_id (foreign key to property_tiers)
 * 2. Add allows_credit_bookings flag
 * 3. Add credit_booking_notice_days (minimum advance booking for credit payments)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add tier_id column
    await queryInterface.addColumn('properties', 'tier_id', {
      type: Sequelize.INTEGER,
      allowNull: true, // Nullable initially for existing properties
      after: 'id',
      references: {
        model: 'property_tiers',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      comment: 'Property tier for credit calculations (DIAMOND, GOLD, etc.)',
    });

    // Add allows_credit_bookings flag
    await queryInterface.addColumn('properties', 'allows_credit_bookings', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      after: 'tier_id',
      comment: 'Whether this property accepts credit-based bookings',
    });

    // Add minimum notice days for credit bookings
    await queryInterface.addColumn('properties', 'credit_booking_notice_days', {
      type: Sequelize.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 7,
      after: 'allows_credit_bookings',
      comment: 'Minimum days in advance required for credit bookings',
    });

    // 🔥 CRITICAL INDEX: Tier-based queries (group properties by tier)
    await queryInterface.addIndex('properties', ['tier_id'], {
      name: 'idx_properties_tier',
      using: 'BTREE',
    });

    // Index for filtering properties that accept credits
    await queryInterface.addIndex('properties', ['allows_credit_bookings'], {
      name: 'idx_properties_credit_bookings',
      using: 'BTREE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('properties', 'idx_properties_credit_bookings');
    await queryInterface.removeIndex('properties', 'idx_properties_tier');
    await queryInterface.removeColumn('properties', 'credit_booking_notice_days');
    await queryInterface.removeColumn('properties', 'allows_credit_bookings');
    await queryInterface.removeColumn('properties', 'tier_id');
  },
};
