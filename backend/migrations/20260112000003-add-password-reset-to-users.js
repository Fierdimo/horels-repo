'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableInfo = await queryInterface.describeTable('users');
    
    if (!tableInfo.password_reset_token) {
      await queryInterface.addColumn('users', 'password_reset_token', {
        type: Sequelize.STRING,
        allowNull: true,
      });
    }
    
    if (!tableInfo.password_reset_expires) {
      await queryInterface.addColumn('users', 'password_reset_expires', {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn('users', 'password_reset_token');
    await queryInterface.removeColumn('users', 'password_reset_expires');
  }
};
