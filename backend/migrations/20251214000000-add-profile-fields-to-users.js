'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableDescription = await queryInterface.describeTable('users');
    
    if (!tableDescription.first_name) {
      await queryInterface.addColumn('users', 'first_name', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'status'
      });
    }

    if (!tableDescription.last_name) {
      await queryInterface.addColumn('users', 'last_name', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'first_name'
      });
    }

    if (!tableDescription.phone) {
      await queryInterface.addColumn('users', 'phone', {
        type: Sequelize.STRING,
        allowNull: true,
        after: 'last_name'
      });
    }

    if (!tableDescription.address) {
      await queryInterface.addColumn('users', 'address', {
        type: Sequelize.TEXT,
        allowNull: true,
        after: 'phone'
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'first_name');
    await queryInterface.removeColumn('users', 'last_name');
    await queryInterface.removeColumn('users', 'phone');
    await queryInterface.removeColumn('users', 'address');
  }
};
