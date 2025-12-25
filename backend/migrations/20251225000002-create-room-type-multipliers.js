'use strict';

/**
 * Migration: Create room_type_multipliers table
 * 
 * Purpose: Store credit multipliers for different room types (Standard, Superior, Deluxe, Suite)
 * Used in credit calculation formula: Credits = Base × Location × RoomType
 * 
 * Performance Optimizations:
 * - UNIQUE index on room_type for O(1) lookups
 * - INT type for IDs (faster than BIGINT for moderate datasets)
 * - DECIMAL(3,2) for precise multiplier calculations
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('room_type_multipliers', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      room_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        unique: true, // Ensures fast O(1) lookup by room type
        comment: 'Room type identifier: STANDARD, SUPERIOR, DELUXE, SUITE, PRESIDENTIAL',
      },
      multiplier: {
        type: Sequelize.DECIMAL(3, 2),
        allowNull: false,
        comment: 'Credit multiplier for this room type (e.g., 1.00, 1.20, 1.50, 2.00)',
      },
      description: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'Human-readable description of room type',
      },
      display_order: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: 'Order for UI display (1=first, higher=later)',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Whether this room type is currently available for bookings',
      },
      created_at: {
        type: Sequelize.DATE(3), // Millisecond precision
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
      },
      updated_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'),
      },
    });

    // Create index for filtering active room types (used in UI dropdowns)
    await queryInterface.addIndex('room_type_multipliers', ['is_active'], {
      name: 'idx_room_type_active',
      using: 'BTREE',
    });

    // Seed initial room type multipliers
    await queryInterface.bulkInsert('room_type_multipliers', [
      {
        room_type: 'STANDARD',
        multiplier: 1.00,
        description: 'Standard room - base multiplier',
        display_order: 1,
        is_active: true,
      },
      {
        room_type: 'SUPERIOR',
        multiplier: 1.20,
        description: 'Superior room - 20% premium',
        display_order: 2,
        is_active: true,
      },
      {
        room_type: 'DELUXE',
        multiplier: 1.50,
        description: 'Deluxe room - 50% premium',
        display_order: 3,
        is_active: true,
      },
      {
        room_type: 'SUITE',
        multiplier: 2.00,
        description: 'Suite - 100% premium',
        display_order: 4,
        is_active: true,
      },
      {
        room_type: 'PRESIDENTIAL',
        multiplier: 3.00,
        description: 'Presidential Suite - 200% premium',
        display_order: 5,
        is_active: true,
      },
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('room_type_multipliers');
  },
};
