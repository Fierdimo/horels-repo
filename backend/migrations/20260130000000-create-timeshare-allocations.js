'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('timeshare_allocations', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      pms_resource_id: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      pms_provider: {
        type: Sequelize.ENUM('mews', 'cloudbeds', 'opera', 'resnexus', 'other'),
        allowNull: false,
        defaultValue: 'mews',
      },
      pms_metadata: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      room_number: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      room_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      floor_number: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      valid_from: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      allocation_type: {
        type: Sequelize.ENUM('ANNUAL_CONTRACT', 'PERPETUAL', 'SEASONAL'),
        allowNull: false,
        defaultValue: 'ANNUAL_CONTRACT',
      },
      prepaid_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      condominium_fee: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR',
      },
      status: {
        type: Sequelize.ENUM('ACTIVE', 'EXPIRED', 'SUSPENDED', 'DELETED'),
        allowNull: false,
        defaultValue: 'ACTIVE',
      },
      current_week_owner_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      is_released: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      contract_reference: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      last_sync_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
    });

    // Create indexes
    await queryInterface.addIndex('timeshare_allocations', ['property_id'], {
      name: 'idx_allocations_property',
    });

    await queryInterface.addIndex('timeshare_allocations', ['pms_resource_id', 'pms_provider'], {
      name: 'idx_allocations_pms_resource',
    });

    await queryInterface.addIndex('timeshare_allocations', ['valid_from', 'valid_until'], {
      name: 'idx_allocations_dates',
    });

    await queryInterface.addIndex('timeshare_allocations', ['status', 'is_released'], {
      name: 'idx_allocations_status',
    });

    await queryInterface.addIndex('timeshare_allocations', ['current_week_owner_id'], {
      name: 'idx_allocations_owner',
    });

    // Create unique constraint for active allocations
    await queryInterface.addConstraint('timeshare_allocations', {
      fields: ['property_id', 'pms_resource_id', 'status'],
      type: 'unique',
      name: 'unique_active_allocation',
      where: {
        status: 'ACTIVE',
      },
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('timeshare_allocations');
  },
};
