'use strict';

/**
 * Migration: Fix room_type_id to allow NULL values
 * The room_type_id field should be optional as it's used for local categorization only.
 * PMS rooms don't necessarily have a room_type assigned initially.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.changeColumn('rooms', 'room_type_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: {
        model: 'room_types',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },

  down: async (queryInterface, Sequelize) => {
    // Revert to NOT NULL (but this might fail if there are NULL values)
    await queryInterface.changeColumn('rooms', 'room_type_id', {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: 'room_types',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
  },
};
