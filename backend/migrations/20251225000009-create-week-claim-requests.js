'use strict';

/**
 * Migration: Create week_claim_requests table
 * 
 * Purpose: Handle user requests to claim ownership of weeks from legacy database
 * Workflow: User submits claim → Admin verifies → Week linked to user → Credits available
 * 
 * Performance Optimizations:
 * - Composite index (user_id, status) for user's pending claims
 * - Index on status for admin queue
 * - Index on week_identifier for duplicate prevention
 * - ENUM for status (1 byte vs VARCHAR)
 * 
 * Query Patterns:
 * - Admin queue: SELECT * WHERE status = 'PENDING' ORDER BY created_at
 * - User claims: SELECT * WHERE user_id = ? AND status IN ('PENDING', 'APPROVED')
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('week_claim_requests', {
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
        comment: 'User claiming ownership of week',
      },
      week_identifier: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Week identifier from legacy database (e.g., "Week 32, Red Season")',
      },
      property_requested: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Property name from legacy database',
      },
      documentation_urls: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'URLs to uploaded proof documents (contracts, receipts, etc.)',
      },
      status: {
        type: Sequelize.ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'PENDING',
        comment: 'Current status of claim',
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
        comment: 'Linked week if claim approved (null while pending)',
      },
      admin_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin notes about verification process',
      },
      rejection_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason for rejection (shown to user)',
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Admin who reviewed the claim',
      },
      reviewed_at: {
        type: Sequelize.DATE(3),
        allowNull: true,
        comment: 'When claim was reviewed',
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

    // 🔥 CRITICAL INDEX: User pending claims
    // Supports: SELECT * FROM week_claim_requests WHERE user_id = ? AND status = 'PENDING'
    await queryInterface.addIndex('week_claim_requests', 
      ['user_id', 'status'], 
      {
        name: 'idx_claim_user_status',
        using: 'BTREE',
      }
    );

    // Index #2: Admin review queue (sorted by submission date)
    await queryInterface.addIndex('week_claim_requests', 
      ['status', 'created_at'], 
      {
        name: 'idx_claim_queue',
        using: 'BTREE',
      }
    );

    // Index #3: Week identifier lookup (prevent duplicate claims)
    await queryInterface.addIndex('week_claim_requests', 
      ['week_identifier'], 
      {
        name: 'idx_claim_week_identifier',
        using: 'BTREE',
      }
    );

    // Index #4: Linked week lookup
    await queryInterface.addIndex('week_claim_requests', 
      ['week_id'], 
      {
        name: 'idx_claim_week',
        using: 'BTREE',
      }
    );

    // Index #5: Admin activity tracking
    await queryInterface.addIndex('week_claim_requests', 
      ['reviewed_by'], 
      {
        name: 'idx_claim_reviewer',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('week_claim_requests');
  },
};
