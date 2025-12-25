'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('platform_settings', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      setting_key: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      setting_value: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      setting_type: {
        type: Sequelize.ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON'),
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    // Add index on setting_key for fast lookups
    await queryInterface.addIndex('platform_settings', ['setting_key'], {
      name: 'platform_settings_key_idx'
    });

    // Insert critical initial settings
    await queryInterface.bulkInsert('platform_settings', [
      {
        setting_key: 'CREDIT_TO_EURO_RATE',
        setting_value: '1.0',
        setting_type: 'NUMBER',
        description: 'Conversion rate: 1 credit = X euros. Admin configurable.',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'CREDIT_EXPIRATION_DAYS',
        setting_value: '180',
        setting_type: 'NUMBER',
        description: '6 months (180 days) expiration period for deposited credits',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'ENABLE_CREDIT_EXPIRATION',
        setting_value: 'true',
        setting_type: 'BOOLEAN',
        description: 'Enable automatic credit expiration after CREDIT_EXPIRATION_DAYS',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'BASE_SEASON_RED',
        setting_value: '1000',
        setting_type: 'NUMBER',
        description: 'Base credit value for RED (high) season weeks',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'BASE_SEASON_WHITE',
        setting_value: '600',
        setting_type: 'NUMBER',
        description: 'Base credit value for WHITE (medium) season weeks',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'BASE_SEASON_BLUE',
        setting_value: '300',
        setting_type: 'NUMBER',
        description: 'Base credit value for BLUE (low) season weeks',
        created_at: new Date(),
        updated_at: new Date()
      },
      {
        setting_key: 'EXPIRATION_WARNING_DAYS',
        setting_value: '30,7,1',
        setting_type: 'STRING',
        description: 'Days before expiration to send warning notifications (comma-separated)',
        created_at: new Date(),
        updated_at: new Date()
      }
    ]);
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('platform_settings');
  }
};
