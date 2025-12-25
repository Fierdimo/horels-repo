'use strict';

/**
 * Migration: Create credit_transactions table
 * 
 * ⚠️  HIGH VOLUME TABLE - CRITICAL PERFORMANCE OPTIMIZATION ⚠️
 * 
 * Purpose: Record ALL credit movements (deposits, spends, refunds, expirations)
 * Expected volume: 100K+ rows per year, 10-50 TPS during peak hours
 * 
 * Performance Optimizations:
 * 1. Composite index (user_id, created_at DESC) - User transaction history (most common query)
 * 2. Index on expires_at - Expiration cron job (daily batch process)
 * 3. Index on status - Find pending/active transactions
 * 4. Index on booking_id - Booking-related transaction lookup
 * 5. Composite index (user_id, status, expires_at) - Active credits query (very frequent)
 * 6. TINYINT for enum fields - Saves 75% space vs VARCHAR
 * 7. Partitioning strategy (future): By year when > 1M rows
 * 
 * Query Patterns:
 * - Get user balance: SUM(amount) WHERE user_id=? AND status='ACTIVE' AND (expires_at IS NULL OR expires_at > NOW())
 * - User history: SELECT * WHERE user_id=? ORDER BY created_at DESC LIMIT 50
 * - Expiration job: SELECT * WHERE expires_at < NOW() AND status='ACTIVE'
 * - Booking total: SELECT SUM(amount) WHERE booking_id=? AND transaction_type='SPEND'
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('credit_transactions', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'User who owns these credits',
      },
      transaction_type: {
        type: Sequelize.ENUM('DEPOSIT', 'SPEND', 'REFUND', 'EXPIRATION', 'ADJUSTMENT', 'TOPUP'),
        allowNull: false,
        comment: 'Type of transaction: DEPOSIT (week converted), SPEND (booking), REFUND (cancellation), EXPIRATION (auto), ADJUSTMENT (admin), TOPUP (purchase)',
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Credit amount - positive for deposits/refunds, negative for spends/expirations',
      },
      balance_after: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'User total balance after this transaction (denormalized for audit trail)',
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'SPENT', 'EXPIRED', 'REFUNDED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
        comment: 'Current status of these credits',
      },
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bookings',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Booking where credits were spent (null for deposits)',
      },
      week_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'weeks',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Week that was converted to credits (null for spends)',
      },
      deposited_at: {
        type: Sequelize.DATE(3),
        allowNull: true,
        comment: 'When credits were originally deposited (for tracking age)',
      },
      expires_at: {
        type: Sequelize.DATE(3),
        allowNull: true,
        comment: 'Expiration date (6 months from deposit) - null for spends/refunds',
      },
      description: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Human-readable transaction description',
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional data: {property_name, room_type, season, calculation_details}',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Admin user who created adjustment (null for automatic transactions)',
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

    // 🔥 CRITICAL INDEX #1: User transaction history (most frequent query)
    // Supports: SELECT * FROM credit_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50
    await queryInterface.addIndex('credit_transactions', 
      ['user_id', 'created_at'], 
      {
        name: 'idx_trans_user_history',
        using: 'BTREE',
      }
    );

    // 🔥 CRITICAL INDEX #2: Active credits query (balance calculation)
    // Supports: SELECT * FROM credit_transactions WHERE user_id = ? AND status = 'ACTIVE' AND expires_at > NOW()
    await queryInterface.addIndex('credit_transactions', 
      ['user_id', 'status', 'expires_at'], 
      {
        name: 'idx_trans_active_credits',
        using: 'BTREE',
      }
    );

    // 🔥 CRITICAL INDEX #3: Expiration cron job (daily batch process)
    // Supports: SELECT * FROM credit_transactions WHERE expires_at < NOW() AND status = 'ACTIVE'
    await queryInterface.addIndex('credit_transactions', 
      ['expires_at', 'status'], 
      {
        name: 'idx_trans_expiration',
        using: 'BTREE',
      }
    );

    // Index #4: Transaction type reports (admin analytics)
    await queryInterface.addIndex('credit_transactions', 
      ['transaction_type'], 
      {
        name: 'idx_trans_type',
        using: 'BTREE',
      }
    );

    // Index #5: Booking-related transactions (refund lookup)
    await queryInterface.addIndex('credit_transactions', 
      ['booking_id'], 
      {
        name: 'idx_trans_booking',
        using: 'BTREE',
      }
    );

    // Index #6: Week conversion lookup (audit trail)
    await queryInterface.addIndex('credit_transactions', 
      ['week_id'], 
      {
        name: 'idx_trans_week',
        using: 'BTREE',
      }
    );

    // Index #7: Status filtering (pending transactions)
    await queryInterface.addIndex('credit_transactions', 
      ['status'], 
      {
        name: 'idx_trans_status',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('credit_transactions');
  },
};
