"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mews_webhook_events', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      webhook_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'mews_webhooks', key: 'id' },
        onDelete: 'CASCADE',
      },
      discriminator: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      entity_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      idempotency_key: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      processed_at: {
        type: Sequelize.DATE,
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
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      }
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('mews_webhook_events');
  }
};
