'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('pms_sync_logs', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      sync_type: {
        type: Sequelize.ENUM('availability', 'bookings', 'prices', 'full', 'manual'),
        allowNull: false,
        defaultValue: 'manual'
      },
      status: {
        type: Sequelize.ENUM('pending', 'running', 'completed', 'failed'),
        allowNull: false,
        defaultValue: 'pending'
      },
      started_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      completed_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      records_processed: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      records_created: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      records_updated: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      records_failed: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0
      },
      errors: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'JSON array of error messages'
      },
      error_details: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Detailed error information for debugging'
      },
      triggered_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who triggered the sync (NULL for automatic syncs)'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    // Indexes for better query performance
    await queryInterface.addIndex('pms_sync_logs', ['property_id'], {
      name: 'idx_pms_sync_logs_property'
    });

    await queryInterface.addIndex('pms_sync_logs', ['status'], {
      name: 'idx_pms_sync_logs_status'
    });

    await queryInterface.addIndex('pms_sync_logs', ['sync_type'], {
      name: 'idx_pms_sync_logs_type'
    });

    await queryInterface.addIndex('pms_sync_logs', ['created_at'], {
      name: 'idx_pms_sync_logs_created'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('pms_sync_logs');
  }
};
