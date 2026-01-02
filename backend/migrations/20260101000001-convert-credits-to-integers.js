'use strict';

/**
 * Migration: Convert credit fields from DECIMAL to INTEGER
 * 
 * Purpose: Credits are always whole numbers, not fractional values.
 * Using DECIMAL(10,2) causes floating point issues and incorrect displays.
 * 
 * Changes:
 * - user_credit_wallets: total_balance, total_earned, total_spent, total_expired, pending_expiration
 * - credit_transactions: amount, balance_after
 * 
 * All changed from DECIMAL(10,2) to INTEGER
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // First, round any existing decimal values to integers
    await queryInterface.sequelize.query(`
      UPDATE user_credit_wallets 
      SET 
        total_balance = ROUND(total_balance),
        total_earned = ROUND(total_earned),
        total_spent = ROUND(total_spent),
        total_expired = ROUND(total_expired),
        pending_expiration = ROUND(pending_expiration)
    `);

    await queryInterface.sequelize.query(`
      UPDATE credit_transactions 
      SET 
        amount = ROUND(amount),
        balance_after = ROUND(balance_after)
    `);

    // Now alter the column types to INTEGER
    // user_credit_wallets
    await queryInterface.changeColumn('user_credit_wallets', 'total_balance', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.changeColumn('user_credit_wallets', 'total_earned', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.changeColumn('user_credit_wallets', 'total_spent', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.changeColumn('user_credit_wallets', 'total_expired', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    await queryInterface.changeColumn('user_credit_wallets', 'pending_expiration', {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
    });

    // credit_transactions
    await queryInterface.changeColumn('credit_transactions', 'amount', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    await queryInterface.changeColumn('credit_transactions', 'balance_after', {
      type: Sequelize.INTEGER,
      allowNull: false,
    });

    console.log('✅ Successfully converted credit fields to INTEGER');
  },

  down: async (queryInterface, Sequelize) => {
    // Revert back to DECIMAL if needed
    // user_credit_wallets
    await queryInterface.changeColumn('user_credit_wallets', 'total_balance', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    });

    await queryInterface.changeColumn('user_credit_wallets', 'total_earned', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    });

    await queryInterface.changeColumn('user_credit_wallets', 'total_spent', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    });

    await queryInterface.changeColumn('user_credit_wallets', 'total_expired', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    });

    await queryInterface.changeColumn('user_credit_wallets', 'pending_expiration', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.00,
    });

    // credit_transactions
    await queryInterface.changeColumn('credit_transactions', 'amount', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });

    await queryInterface.changeColumn('credit_transactions', 'balance_after', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: false,
    });

    console.log('✅ Reverted credit fields back to DECIMAL');
  }
};
