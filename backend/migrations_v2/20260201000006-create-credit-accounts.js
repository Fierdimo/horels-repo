'use strict';

/**
 * V2 Migration 6: Create credit_accounts table
 * 
 * User credit balances. Simple table, single source of truth for balance.
 * See: docs_v2/DATABASE_DESIGN.md - Section "credit_accounts"
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('credit_accounts', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      user_id: {
        type: Sequelize.INTEGER.UNSIGNED, // Match users.id type
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: '1:1 relationship with users'
      },
      
      // Balance (calculated, never manually updated)
      balance: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Updated via trigger from credit_transactions'
      },
      
      // Limits & Restrictions
      credit_limit: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Max negative balance (for staff/VIP), NULL = no limit'
      },
      expiration_policy: {
        type: Sequelize.ENUM('NEVER', '1_YEAR', '2_YEARS'),
        defaultValue: '2_YEARS'
      },
      
      // Metadata
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR'
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      
      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      },
      last_transaction_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Last credit transaction timestamp'
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    // Indexes
    await queryInterface.addIndex('credit_accounts', ['balance'], {
      name: 'idx_balance',
      comment: 'Find users with high/low balances'
    });
    
    await queryInterface.addIndex('credit_accounts', ['last_transaction_at'], {
      name: 'idx_last_transaction',
      comment: 'Find inactive accounts'
    });

    console.log('✅ Created credit_accounts table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('credit_accounts');
  }
};
