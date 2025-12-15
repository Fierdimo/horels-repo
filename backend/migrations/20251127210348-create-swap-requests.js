'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('swap_requests', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      requester_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      requester_week_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'weeks',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      responder_week_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'weeks',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      desired_start_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      desired_end_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'matched', 'completed', 'cancelled'),
        defaultValue: 'pending',
      },
      swap_fee: {
        type: Sequelize.DECIMAL(10, 2),
        defaultValue: 10.00,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Add indexes for performance
    await queryInterface.addIndex('swap_requests', ['requester_id']);
    await queryInterface.addIndex('swap_requests', ['requester_week_id']);
    await queryInterface.addIndex('swap_requests', ['responder_week_id']);
    await queryInterface.addIndex('swap_requests', ['status']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('swap_requests');
  }
};
