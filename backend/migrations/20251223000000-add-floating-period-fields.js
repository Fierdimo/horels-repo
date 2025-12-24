'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Make start_date and end_date nullable for floating periods
    await queryInterface.changeColumn('weeks', 'start_date', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    await queryInterface.changeColumn('weeks', 'end_date', {
      type: Sequelize.DATE,
      allowNull: true,
    });

    // Add nights column for floating periods
    await queryInterface.addColumn('weeks', 'nights', {
      type: Sequelize.INTEGER,
      allowNull: true,
      comment: 'Number of nights for floating periods (when start_date is null)'
    });

    // Add valid_until column for floating periods
    await queryInterface.addColumn('weeks', 'valid_until', {
      type: Sequelize.DATE,
      allowNull: true,
      comment: 'Expiration date for floating periods'
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Remove added columns
    await queryInterface.removeColumn('weeks', 'nights');
    await queryInterface.removeColumn('weeks', 'valid_until');

    // Restore start_date and end_date as non-nullable
    await queryInterface.changeColumn('weeks', 'start_date', {
      type: Sequelize.DATE,
      allowNull: false,
    });

    await queryInterface.changeColumn('weeks', 'end_date', {
      type: Sequelize.DATE,
      allowNull: false,
    });
  }
};
