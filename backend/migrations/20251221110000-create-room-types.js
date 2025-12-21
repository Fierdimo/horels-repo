'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Create room_types table
    await queryInterface.createTable('room_types', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true,
        comment: 'Room type name (standard, deluxe, suite, etc.)'
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Description of the room type'
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

    // Insert default room types
    await queryInterface.bulkInsert('room_types', [
      { name: 'standard', description: 'Standard room with basic amenities', created_at: new Date(), updated_at: new Date() },
      { name: 'deluxe', description: 'Deluxe room with premium amenities', created_at: new Date(), updated_at: new Date() },
      { name: 'suite', description: 'Suite with living area and bedroom', created_at: new Date(), updated_at: new Date() },
      { name: 'single', description: 'Single room for one guest', created_at: new Date(), updated_at: new Date() },
      { name: 'double', description: 'Double room for two guests', created_at: new Date(), updated_at: new Date() },
    ]);

    console.log('✅ Created room_types table with default types');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('room_types');
  }
};
