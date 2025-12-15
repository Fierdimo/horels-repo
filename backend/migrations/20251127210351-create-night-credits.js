'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('night_credits', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      owner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      original_week_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'weeks',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      total_nights: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      remaining_nights: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      expiry_date: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('active', 'expired', 'used'),
        defaultValue: 'active',
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
    await queryInterface.addIndex('night_credits', ['owner_id']);
    await queryInterface.addIndex('night_credits', ['original_week_id']);
    await queryInterface.addIndex('night_credits', ['status']);
    await queryInterface.addIndex('night_credits', ['expiry_date']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('night_credits');
  }
};
