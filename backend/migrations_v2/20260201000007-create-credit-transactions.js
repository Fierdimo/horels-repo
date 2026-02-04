'use strict';

/**
 * V2 Migration 7: Create credit_transactions table
 * 
 * ⚠️ IMMUTABLE LEDGER - Append-only table, NO updates, NO deletes
 * All credit movements tracked here. Integrity enforced at DB level.
 * 
 * See: docs_v2/DATABASE_DESIGN.md - Section "credit_transactions"
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('credit_transactions', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        comment: 'BIGINT for billions of transactions'
      },
      account_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'credit_accounts',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      
      // Transaction Details
      type: {
        type: Sequelize.ENUM(
          'WEEK_RELEASE',
          'WEEK_BOOKING',
          'CREDIT_PURCHASE',
          'CREDIT_EXPIRATION',
          'CONDOMINIUM_PAYMENT',
          'REFUND',
          'ADJUSTMENT',
          'BONUS',
          'PENALTY'
        ),
        allowNull: false
      },
      
      // Amounts (positive = credit, negative = debit)
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Positive = credit in, Negative = debit out'
      },
      balance_before: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Balance before this transaction (audit trail)'
      },
      balance_after: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Balance after this transaction (audit trail)'
      },
      
      // References (what triggered this transaction)
      reference_type: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'e.g., "week_allocation", "booking", "payment"'
      },
      reference_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID of the referenced entity'
      },
      
      // Metadata
      description: {
        type: Sequelize.STRING(500),
        allowNull: false,
        comment: 'Human-readable description'
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Additional details, calculations, etc.'
      },
      
      // Audit Trail
      created_by: {
        type: Sequelize.INTEGER.UNSIGNED, // Match users.id type
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Admin user if manual transaction'
      },
      ip_address: {
        type: Sequelize.STRING(45),
        allowNull: true,
        comment: 'IPv6-compatible'
      },
      user_agent: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      
      // Immutable timestamp
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        comment: 'IMMUTABLE - no updated_at'
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    // Indexes
    await queryInterface.addIndex('credit_transactions', ['account_id', 'created_at'], {
      name: 'idx_account_date',
      comment: 'User transaction history (DESC order)',
      order: [['account_id', 'ASC'], ['created_at', 'DESC']]
    });
    
    await queryInterface.addIndex('credit_transactions', ['type', 'created_at'], {
      name: 'idx_type'
    });
    
    await queryInterface.addIndex('credit_transactions', ['reference_type', 'reference_id'], {
      name: 'idx_reference',
      comment: 'Find transactions for specific entity'
    });
    
    await queryInterface.addIndex('credit_transactions', ['created_at'], {
      name: 'idx_created_at',
      comment: 'Time-based queries, reporting'
    });

    console.log('✅ Created credit_transactions table (IMMUTABLE LEDGER)');
    console.log('⚠️  This table is APPEND-ONLY - NO updates, NO deletes allowed');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('credit_transactions');
  }
};
