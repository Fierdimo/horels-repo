'use strict';

/**
 * V2 Migration: Add tracking columns to credit_accounts
 * 
 * Adds total_earned, total_spent, and total_expired columns
 * to track credit lifecycle analytics.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('credit_accounts');

    if (!tableInfo.total_earned) {
      await queryInterface.addColumn('credit_accounts', 'total_earned', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        after: 'balance',
        comment: 'Total credits earned (from week releases, etc.)'
      });
    }

    if (!tableInfo.total_spent) {
      await queryInterface.addColumn('credit_accounts', 'total_spent', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        after: 'total_earned',
        comment: 'Total credits spent on bookings'
      });
    }

    if (!tableInfo.total_expired) {
      await queryInterface.addColumn('credit_accounts', 'total_expired', {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        after: 'total_spent',
        comment: 'Total credits that expired'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('credit_accounts', 'total_expired');
    await queryInterface.removeColumn('credit_accounts', 'total_spent');
    await queryInterface.removeColumn('credit_accounts', 'total_earned');
  }
};
