'use strict';

/**
 * Migration: Create credit_booking_costs table
 * 
 * Purpose: Store credit costs for booking each room type/season at each property
 * Used during booking to calculate how many credits are needed
 * 
 * Performance Optimizations:
 * - UNIQUE composite index (property_id, room_type, season, effective_date) for O(1) cost lookups
 * - INT UNSIGNED for IDs (faster joins, 4 bytes)
 * - ENUM for season (1 byte vs 4+ for VARCHAR)
 * - Additional indexes for property queries and effective date searches
 * 
 * Query Pattern: Find cost for booking
 * SELECT credits_per_night FROM credit_booking_costs 
 * WHERE property_id = ? AND room_type = ? AND season = ? 
 * AND effective_date <= ? 
 * ORDER BY effective_date DESC LIMIT 1
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('credit_booking_costs', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Property for which this cost applies',
      },
      room_type: {
        type: Sequelize.STRING(50),
        allowNull: false,
        comment: 'Room type: STANDARD, SUPERIOR, DELUXE, SUITE, etc.',
      },
      season: {
        type: Sequelize.ENUM('RED', 'WHITE', 'BLUE'),
        allowNull: false,
        comment: 'Season: RED (high), WHITE (medium), BLUE (low)',
      },
      credits_per_night: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Credit cost per night for this room/season combination',
      },
      effective_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Date from which this pricing is effective (allows price history)',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin notes about this pricing (special events, promotions, etc.)',
      },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Admin who set this pricing',
      },
      created_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3)'),
      },
      updated_at: {
        type: Sequelize.DATE(3),
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3)'),
      },
    });

    // 🔥 CRITICAL INDEX: Unique cost lookup (prevents duplicates + enables O(1) search)
    // Supports: Find current cost for property/room/season combination
    await queryInterface.addIndex('credit_booking_costs', 
      ['property_id', 'room_type', 'season', 'effective_date'], 
      {
        name: 'idx_cost_unique_lookup',
        unique: true,
        using: 'BTREE',
      }
    );

    // Index #2: Property-based queries (admin management interface)
    await queryInterface.addIndex('credit_booking_costs', 
      ['property_id'], 
      {
        name: 'idx_cost_property',
        using: 'BTREE',
      }
    );

    // Index #3: Effective date searches (price history)
    await queryInterface.addIndex('credit_booking_costs', 
      ['effective_date'], 
      {
        name: 'idx_cost_effective_date',
        using: 'BTREE',
      }
    );

    // Index #4: Season-based reports
    await queryInterface.addIndex('credit_booking_costs', 
      ['season'], 
      {
        name: 'idx_cost_season',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('credit_booking_costs');
  },
};
