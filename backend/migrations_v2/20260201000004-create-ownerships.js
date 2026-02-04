'use strict';

/**
 * V2 Migration 4: Create ownerships table
 * 
 * Timeshare ownership contracts. Links owners to their timeshare units.
 * See: docs_v2/DATABASE_DESIGN.md - Section "ownerships"
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('ownerships', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      
      // Relationships
      owner_id: {
        type: Sequelize.INTEGER.UNSIGNED, // Match users.id type
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      unit_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'timeshare_units',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      
      // Ownership Type
      type: {
        type: Sequelize.ENUM('FIXED_WEEK', 'FLOATING', 'POINTS'),
        allowNull: false
      },
      
      // Fixed Week Configuration (NULL if not fixed)
      fixed_week_number: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: true,
        comment: '1-52, NULL if floating/points'
      },
      
      // Floating/Points Configuration (NULL if fixed)
      annual_points: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: true,
        comment: 'Annual points allocation, NULL if fixed week'
      },
      
      // Contract Details
      purchase_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      contract_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'External contract ID/reference'
      },
      contract_start_year: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Year ownership begins'
      },
      contract_end_year: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Year ownership ends, NULL = perpetual'
      },
      
      // Financials
      annual_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Condominium maintenance fee'
      },
      annual_fee_due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'e.g., Jan 31 each year'
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR'
      },
      last_payment_date: {
        type: Sequelize.DATEONLY,
        allowNull: true
      },
      
      // Status
      status: {
        type: Sequelize.ENUM('ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_PAYMENT'),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      suspension_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      
      // Metadata
      notes: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      metadata: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Custom fields, tags, etc.'
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
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    // Indexes
    await queryInterface.addIndex('ownerships', ['owner_id', 'status'], {
      name: 'idx_owner_status'
    });
    
    await queryInterface.addIndex('ownerships', ['unit_id'], {
      name: 'idx_unit'
    });
    
    await queryInterface.addIndex('ownerships', ['type', 'status'], {
      name: 'idx_type'
    });
    
    await queryInterface.addIndex('ownerships', ['contract_start_year', 'contract_end_year'], {
      name: 'idx_contract_dates'
    });
    
    await queryInterface.addIndex('ownerships', ['status', 'last_payment_date'], {
      name: 'idx_payment_status',
      comment: 'For billing reminders'
    });

    console.log('✅ Created ownerships table with indexes');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('ownerships');
  }
};
