'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn('timeshare_units', 'room_type_multiplier', {
      type: Sequelize.DECIMAL(3, 2),
      allowNull: true,
      defaultValue: null,
      comment: 'Manual override for room type multiplier. NULL = auto-detect from category',
      after: 'base_credit_value'
    });

    await queryInterface.addIndex('timeshare_units', ['room_type_multiplier'], {
      name: 'idx_room_type_multiplier'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeIndex('timeshare_units', 'idx_room_type_multiplier');
    await queryInterface.removeColumn('timeshare_units', 'room_type_multiplier');
  }
};
