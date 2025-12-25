'use strict';

/**
 * Migration: Create inter_property_settlements table
 * 
 * Purpose: Track financial settlements when users book across properties
 * Example: User deposits week at Hotel A (1000 credits) → Books at Hotel B → Hotel A pays Hotel B
 * 
 * Performance Optimizations:
 * - Composite index (from_property_id, status) for outstanding settlements per property
 * - Index on settlement_date for payment schedules
 * - ENUM for status (1 byte)
 * - Indexes on both from/to properties for bilateral queries
 * 
 * Query Patterns:
 * - Property payables: SELECT * WHERE from_property_id = ? AND status = 'PENDING'
 * - Property receivables: SELECT * WHERE to_property_id = ? AND status = 'PENDING'
 * - Settlement reports: SELECT * WHERE settlement_date BETWEEN ? AND ?
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('inter_property_settlements', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Booking that triggered this settlement',
      },
      from_property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Property that owes payment (where week was deposited)',
      },
      to_property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Property that receives payment (where booking was made)',
      },
      credits_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Amount in credits that was spent',
      },
      euro_equivalent: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Euro amount for settlement (credits × conversion rate)',
      },
      conversion_rate: {
        type: Sequelize.DECIMAL(10, 4),
        allowNull: false,
        comment: 'Credit-to-euro rate at time of booking',
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'DISPUTED'),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Settlement status',
      },
      settlement_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
        comment: 'Date when settlement was/will be processed',
      },
      payment_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Bank transfer reference or payment ID',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin notes about settlement',
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

    // 🔥 CRITICAL INDEX #1: Property payables (outgoing settlements)
    // Supports: SELECT * FROM inter_property_settlements WHERE from_property_id = ? AND status = 'PENDING'
    await queryInterface.addIndex('inter_property_settlements', 
      ['from_property_id', 'status'], 
      {
        name: 'idx_settlement_from_status',
        using: 'BTREE',
      }
    );

    // 🔥 CRITICAL INDEX #2: Property receivables (incoming settlements)
    await queryInterface.addIndex('inter_property_settlements', 
      ['to_property_id', 'status'], 
      {
        name: 'idx_settlement_to_status',
        using: 'BTREE',
      }
    );

    // Index #3: Booking reference lookup
    await queryInterface.addIndex('inter_property_settlements', 
      ['booking_id'], 
      {
        name: 'idx_settlement_booking',
        using: 'BTREE',
      }
    );

    // Index #4: Settlement date queries (payment schedules)
    await queryInterface.addIndex('inter_property_settlements', 
      ['settlement_date'], 
      {
        name: 'idx_settlement_date',
        using: 'BTREE',
      }
    );

    // Index #5: Status filtering (admin dashboard)
    await queryInterface.addIndex('inter_property_settlements', 
      ['status'], 
      {
        name: 'idx_settlement_status',
        using: 'BTREE',
      }
    );

    // Index #6: Bilateral property relationships (A ↔ B settlements)
    await queryInterface.addIndex('inter_property_settlements', 
      ['from_property_id', 'to_property_id'], 
      {
        name: 'idx_settlement_properties',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('inter_property_settlements');
  },
};
