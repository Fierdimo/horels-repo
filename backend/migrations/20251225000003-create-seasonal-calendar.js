'use strict';

/**
 * Migration: Create seasonal_calendar table
 * 
 * Purpose: Define RED/WHITE/BLUE season periods for each property
 * Used to determine base credit value when depositing weeks
 * 
 * Performance Optimizations:
 * - Composite index on (property_id, start_date, end_date) for fast date range queries
 * - TINYINT for season_type enum (1 byte vs 4+ bytes for VARCHAR)
 * - DATE type (no time component needed, saves 4 bytes per row)
 * - Index on property_id for per-hotel queries
 * 
 * Query Pattern: Find season for property on specific date
 * SELECT season_type FROM seasonal_calendar 
 * WHERE property_id = ? AND ? BETWEEN start_date AND end_date
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('seasonal_calendar', {
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
        comment: 'Property to which this season period applies',
      },
      season_type: {
        type: Sequelize.ENUM('RED', 'WHITE', 'BLUE'),
        allowNull: false,
        comment: 'Season type: RED (high season), WHITE (medium), BLUE (low)',
      },
      start_date: {
        type: Sequelize.DATEONLY, // DATE without time component
        allowNull: false,
        comment: 'First day of season period (inclusive)',
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
        comment: 'Last day of season period (inclusive)',
      },
      year: {
        type: Sequelize.SMALLINT.UNSIGNED, // 2025, 2026, etc.
        allowNull: false,
        comment: 'Calendar year for this season period',
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Admin notes about this season (holidays, events, etc.)',
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

    // CRITICAL INDEX: Fast date range lookups for credit calculations
    await queryInterface.addIndex('seasonal_calendar', 
      ['property_id', 'start_date', 'end_date'], 
      {
        name: 'idx_season_property_date_range',
        using: 'BTREE',
      }
    );

    // Index for year-based queries (admin calendar management)
    await queryInterface.addIndex('seasonal_calendar', 
      ['property_id', 'year'], 
      {
        name: 'idx_season_property_year',
        using: 'BTREE',
      }
    );

    // Index for season type reports
    await queryInterface.addIndex('seasonal_calendar', 
      ['season_type'], 
      {
        name: 'idx_season_type',
        using: 'BTREE',
      }
    );
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('seasonal_calendar');
  },
};
