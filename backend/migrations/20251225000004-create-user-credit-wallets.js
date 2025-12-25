'use strict';

/**
 * Migration: Create user_credit_wallets table
 * 
 * Purpose: Track credit balance for each user
 * One wallet per user - lightweight table with frequent reads/updates
 * 
 * Performance Optimizations:
 * - UNIQUE index on user_id for O(1) wallet lookups
 * - DECIMAL(10,2) for precise credit calculations (no floating point errors)
 * - Denormalized total_balance for fast reads (avoid SUM aggregation)
 * - Row-level locking strategy for concurrent transactions
 * 
 * Concurrency Strategy:
 * All balance updates MUST use SELECT...FOR UPDATE to prevent race conditions
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('user_credit_wallets', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true, // One wallet per user - enables O(1) lookup
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'User who owns this credit wallet',
      },
      total_balance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Current total credits available (sum of all non-expired deposits)',
      },
      total_earned: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Lifetime credits earned (deposits) - never decreases',
      },
      total_spent: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Lifetime credits spent on bookings - never decreases',
      },
      total_expired: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Lifetime credits lost to expiration - never decreases',
      },
      pending_expiration: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Credits that will expire in next 30 days (for notifications)',
      },
      last_transaction_at: {
        type: Sequelize.DATE(3),
        allowNull: true,
        comment: 'Timestamp of most recent transaction (deposit/spend/refund)',
      },
      created_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
      },
      updated_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'),
      },
    });

    // Index for finding wallets with low balances (for promotions/notifications)
    await queryInterface.addIndex('user_credit_wallets', 
      ['total_balance'], 
      {
        name: 'idx_wallet_balance',
        using: 'BTREE',
      }
    );

    // Index for finding wallets with pending expirations (notification cron job)
    await queryInterface.addIndex('user_credit_wallets', 
      ['pending_expiration'], 
      {
        name: 'idx_wallet_pending_expiration',
        using: 'BTREE',
      }
    );

    // Index for most active users reports
    await queryInterface.addIndex('user_credit_wallets', 
      ['last_transaction_at'], 
      {
        name: 'idx_wallet_last_transaction',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('user_credit_wallets');
  },
};
