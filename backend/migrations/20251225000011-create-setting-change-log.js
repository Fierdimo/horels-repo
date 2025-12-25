'use strict';

/**
 * Migration: Create setting_change_log table
 * 
 * Purpose: Audit trail for platform_settings changes
 * Critical for compliance and troubleshooting (who changed credit rate when?)
 * 
 * Performance Optimizations:
 * - Index on setting_key for specific setting history
 * - Composite index (changed_at, setting_key) for time-based queries
 * - Index on changed_by for admin activity tracking
 * - APPEND-ONLY table (never UPDATE or DELETE) for integrity
 * 
 * Query Patterns:
 * - Setting history: SELECT * WHERE setting_key = ? ORDER BY changed_at DESC
 * - Admin activity: SELECT * WHERE changed_by = ? ORDER BY changed_at DESC
 * - Recent changes: SELECT * WHERE changed_at > ? ORDER BY changed_at DESC
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('setting_change_log', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      setting_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Key from platform_settings that was changed',
      },
      old_value: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Previous value (null if new setting)',
      },
      new_value: {
        type: Sequelize.TEXT,
        allowNull: false,
        comment: 'New value after change',
      },
      change_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Reason provided by admin for change',
      },
      changed_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Admin user who made the change',
      },
      ip_address: {
        type: Sequelize.STRING(45), // IPv6 max length
        allowNull: true,
        comment: 'IP address of admin at time of change',
      },
      user_agent: {
        type: Sequelize.STRING(500),
        allowNull: true,
        comment: 'Browser/client user agent',
      },
      changed_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
        comment: 'Exact timestamp of change',
      },
    });

    // 🔥 CRITICAL INDEX: Setting history (audit trail)
    // Supports: SELECT * FROM setting_change_log WHERE setting_key = ? ORDER BY changed_at DESC
    await queryInterface.addIndex('setting_change_log', 
      ['setting_key', 'changed_at'], 
      {
        name: 'idx_log_setting_time',
        using: 'BTREE',
      }
    );

    // Index #2: Admin activity tracking
    await queryInterface.addIndex('setting_change_log', 
      ['changed_by', 'changed_at'], 
      {
        name: 'idx_log_admin_activity',
        using: 'BTREE',
      }
    );

    // Index #3: Recent changes (dashboard widget)
    await queryInterface.addIndex('setting_change_log', 
      ['changed_at'], 
      {
        name: 'idx_log_time',
        using: 'BTREE',
      }
    );

    // Index #4: Setting key lookup (quick access to all changes for specific setting)
    await queryInterface.addIndex('setting_change_log', 
      ['setting_key'], 
      {
        name: 'idx_log_setting',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('setting_change_log');
  },
};
