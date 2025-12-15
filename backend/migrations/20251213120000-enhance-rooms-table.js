"use strict";

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Agregar campos para control de marketplace y mapeo con PMS
    await queryInterface.addColumn('rooms', 'pms_resource_id', {
      type: Sequelize.STRING(255),
      allowNull: true,
      comment: 'ID de la habitación en el PMS (para mapeo)'
    });

    await queryInterface.addColumn('rooms', 'is_marketplace_enabled', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
      allowNull: false,
      comment: 'Si la habitación está disponible en el marketplace público'
    });

    await queryInterface.addColumn('rooms', 'custom_price', {
      type: Sequelize.DECIMAL(10, 2),
      allowNull: true,
      comment: 'Precio personalizado (override del basePrice si se configura)'
    });

    await queryInterface.addColumn('rooms', 'pms_last_sync', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Última sincronización con PMS'
    });

    await queryInterface.addColumn('rooms', 'images', {
      type: Sequelize.JSON,
      allowNull: true,
      defaultValue: '[]',
      comment: 'Array de URLs de imágenes de la habitación'
    });

    // Agregar índices para mejorar performance
    await queryInterface.addIndex('rooms', ['property_id', 'is_marketplace_enabled'], {
      name: 'idx_rooms_property_marketplace'
    });

    await queryInterface.addIndex('rooms', ['pms_resource_id'], {
      name: 'idx_rooms_pms_resource'
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeIndex('rooms', 'idx_rooms_property_marketplace');
    await queryInterface.removeIndex('rooms', 'idx_rooms_pms_resource');
    
    await queryInterface.removeColumn('rooms', 'pms_resource_id');
    await queryInterface.removeColumn('rooms', 'is_marketplace_enabled');
    await queryInterface.removeColumn('rooms', 'custom_price');
    await queryInterface.removeColumn('rooms', 'pms_last_sync');
    await queryInterface.removeColumn('rooms', 'images');
  }
};
