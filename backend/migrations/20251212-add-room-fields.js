'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('rooms', 'type', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('rooms', 'floor', {
      type: Sequelize.STRING,
      allowNull: true,
    });
    await queryInterface.addColumn('rooms', 'status', {
      type: Sequelize.STRING,
      allowNull: false,
      defaultValue: 'activa',
    });
    await queryInterface.addColumn('rooms', 'amenities', {
      type: Sequelize.JSON,
      allowNull: true,
    });
    await queryInterface.addColumn('rooms', 'basePrice', {
      type: Sequelize.DECIMAL(10,2),
      allowNull: true,
    });
  },
  down: async (queryInterface) => {
    await queryInterface.removeColumn('rooms', 'type');
    await queryInterface.removeColumn('rooms', 'floor');
    await queryInterface.removeColumn('rooms', 'status');
    await queryInterface.removeColumn('rooms', 'amenities');
    await queryInterface.removeColumn('rooms', 'basePrice');
  },
};
