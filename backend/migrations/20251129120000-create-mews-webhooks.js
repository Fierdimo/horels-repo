"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mews_webhooks', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      provider: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: 'mews',
      },
      enterprise_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      integration_id: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      webhook_type: {
        type: Sequelize.ENUM('general', 'integration'),
        allowNull: false,
      },
      action: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      events: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      raw: {
        type: Sequelize.JSON,
        allowNull: false,
      },
      processed: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },
      processing_attempts: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mews_webhooks');
  }
};
