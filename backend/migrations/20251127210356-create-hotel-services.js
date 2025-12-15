'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('hotel_services', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'bookings',
          key: 'id'
        },
        onDelete: 'CASCADE',
        onUpdate: 'CASCADE'
      },
      service_type: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('requested', 'confirmed', 'completed', 'cancelled'),
        defaultValue: 'requested',
      },
      quantity: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      price: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      requested_at: {
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
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
    await queryInterface.addIndex('hotel_services', ['booking_id']);
    await queryInterface.addIndex('hotel_services', ['service_type']);
    await queryInterface.addIndex('hotel_services', ['status']);
    await queryInterface.addIndex('hotel_services', ['requested_at']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('hotel_services');
  }
};
