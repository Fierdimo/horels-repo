"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Verificar si la columna ya existe
    const tableDescription = await queryInterface.describeTable('bookings');
    
    if (!tableDescription.room_id) {
      // Agregar room_id a bookings para trackear habitación específica
      await queryInterface.addColumn('bookings', 'room_id', {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Habitación específica reservada'
      });
    }

    // Verificar y crear índices solo si no existen
    const indexes = await queryInterface.showIndex('bookings');
    const indexNames = indexes.map(idx => idx.name);

    if (!indexNames.includes('idx_bookings_room_dates')) {
      await queryInterface.addIndex('bookings', ['room_id', 'check_in', 'check_out'], {
        name: 'idx_bookings_room_dates'
      });
    }

    if (!indexNames.includes('idx_bookings_availability_search')) {
      await queryInterface.addIndex('bookings', ['property_id', 'status', 'check_in', 'check_out'], {
        name: 'idx_bookings_availability_search'
      });
    }
  },

  async down(queryInterface, Sequelize) {
    const indexes = await queryInterface.showIndex('bookings');
    const indexNames = indexes.map(idx => idx.name);

    if (indexNames.includes('idx_bookings_room_dates')) {
      await queryInterface.removeIndex('bookings', 'idx_bookings_room_dates');
    }
    
    if (indexNames.includes('idx_bookings_availability_search')) {
      await queryInterface.removeIndex('bookings', 'idx_bookings_availability_search');
    }

    const tableDescription = await queryInterface.describeTable('bookings');
    if (tableDescription.room_id) {
      await queryInterface.removeColumn('bookings', 'room_id');
    }
  }
};
