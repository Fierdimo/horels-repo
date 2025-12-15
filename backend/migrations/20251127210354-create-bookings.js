'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('bookings', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      guest_name: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      guest_email: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      check_in: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      check_out: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      room_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('confirmed', 'checked_in', 'checked_out', 'cancelled'),
        defaultValue: 'confirmed',
      },
      guest_token: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      total_amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      currency: {
        type: Sequelize.STRING(3),
        defaultValue: 'EUR',
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
    await queryInterface.addIndex('bookings', ['property_id']);
    await queryInterface.addIndex('bookings', ['guest_email']);
    await queryInterface.addIndex('bookings', ['guest_token']);
    await queryInterface.addIndex('bookings', ['status']);
    await queryInterface.addIndex('bookings', ['check_in']);
    await queryInterface.addIndex('bookings', ['check_out']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('bookings');
  }
};
