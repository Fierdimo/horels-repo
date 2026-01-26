'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('UserPreferences', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      email_notifications: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      swap_notifications: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      booking_notifications: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      marketing_emails: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      credit_expiry_alerts: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      weekly_summary: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      language: {
        type: Sequelize.STRING(10),
        allowNull: true,
      },
      timezone: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    // Add index on user_id for faster lookups
    await queryInterface.addIndex('UserPreferences', ['user_id'], {
      name: 'idx_user_preferences_user_id',
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('UserPreferences');
  },
};
