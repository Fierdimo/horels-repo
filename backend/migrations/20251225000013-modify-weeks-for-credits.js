'use strict';

/**
 * Migration: Modify weeks table for credit system
 * 
 * Purpose: Add credit conversion tracking to weeks
 * 
 * Performance Optimizations:
 * - Index on deposited_for_credits for filtering available/converted weeks
 * - Index on credits_earned for reporting
 * - Composite index (user_id, deposited_for_credits) for user week management
 * 
 * Changes:
 * 1. Add deposited_for_credits flag
 * 2. Add credits_earned (snapshot of calculation)
 * 3. Add credit_deposit_date
 * 4. Add credit_expiration_date
 * 5. Add season_at_deposit (RED/WHITE/BLUE snapshot)
 * 6. Add room_type_at_deposit (for historical accuracy)
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Flag indicating if week was converted to credits
    await queryInterface.addColumn('weeks', 'deposited_for_credits', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      after: 'owner_id',
      comment: 'Whether this week has been converted to credits',
    });

    // Snapshot of credits earned from deposit
    await queryInterface.addColumn('weeks', 'credits_earned', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      after: 'deposited_for_credits',
      comment: 'Credits earned when week was deposited (null if not deposited)',
    });

    // When week was converted to credits
    await queryInterface.addColumn('weeks', 'credit_deposit_date', {
      type: Sequelize.DATE(3),
      allowNull: true,
      after: 'credits_earned',
      comment: 'Timestamp when week was converted to credits',
    });

    // When credits from this week will expire
    await queryInterface.addColumn('weeks', 'credit_expiration_date', {
      type: Sequelize.DATE(3),
      allowNull: true,
      after: 'credit_deposit_date',
      comment: 'Expiration date for credits from this week (deposit_date + 6 months)',
    });

    // Snapshot of season at time of deposit (for audit/history)
    await queryInterface.addColumn('weeks', 'season_at_deposit', {
      type: Sequelize.ENUM('RED', 'WHITE', 'BLUE'),
      allowNull: true,
      after: 'credit_expiration_date',
      comment: 'Season color at time of deposit (historical snapshot)',
    });

    // Snapshot of room type at time of deposit
    await queryInterface.addColumn('weeks', 'room_type_at_deposit', {
      type: Sequelize.STRING(50),
      allowNull: true,
      after: 'season_at_deposit',
      comment: 'Room type at time of deposit (historical snapshot)',
    });

    // Calculation breakdown stored as JSON
    await queryInterface.addColumn('weeks', 'credit_calculation_metadata', {
      type: Sequelize.JSON,
      allowNull: true,
      after: 'room_type_at_deposit',
      comment: 'Detailed calculation: {base_value, location_multiplier, room_multiplier, formula}',
    });

    // 🔥 CRITICAL INDEX: Filter deposited vs available weeks
    await queryInterface.addIndex('weeks', ['deposited_for_credits'], {
      name: 'idx_weeks_deposited',
      using: 'BTREE',
    });

    // Index for user week management (user's available weeks)
    await queryInterface.addIndex('weeks', ['owner_id', 'deposited_for_credits'], {
      name: 'idx_weeks_owner_available',
      using: 'BTREE',
    });

    // Index for credit expiration tracking
    await queryInterface.addIndex('weeks', ['credit_expiration_date'], {
      name: 'idx_weeks_credit_expiration',
      using: 'BTREE',
    });

    // Index for credits earned reporting
    await queryInterface.addIndex('weeks', ['credits_earned'], {
      name: 'idx_weeks_credits_earned',
      using: 'BTREE',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('weeks', 'idx_weeks_credits_earned');
    await queryInterface.removeIndex('weeks', 'idx_weeks_credit_expiration');
    await queryInterface.removeIndex('weeks', 'idx_weeks_owner_available');
    await queryInterface.removeIndex('weeks', 'idx_weeks_deposited');
    
    await queryInterface.removeColumn('weeks', 'credit_calculation_metadata');
    await queryInterface.removeColumn('weeks', 'room_type_at_deposit');
    await queryInterface.removeColumn('weeks', 'season_at_deposit');
    await queryInterface.removeColumn('weeks', 'credit_expiration_date');
    await queryInterface.removeColumn('weeks', 'credit_deposit_date');
    await queryInterface.removeColumn('weeks', 'credits_earned');
    await queryInterface.removeColumn('weeks', 'deposited_for_credits');
  },
};
