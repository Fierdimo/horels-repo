'use strict';

/**
 * V2 Migration: Create seasonal_calendar table
 *
 * Stores per-property season period configuration (RED/WHITE/BLUE).
 * If no entry exists for a date, the system falls back to a default calendar.
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tables = await queryInterface.showAllTables();
    if (tables.includes('seasonal_calendar')) {
      console.log('⏭️  seasonal_calendar table already exists');
      return;
    }

    await queryInterface.createTable('seasonal_calendar', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false
      },
      property_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'timeshare_properties',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      },
      season_type: {
        type: Sequelize.ENUM('RED', 'WHITE', 'BLUE'),
        allowNull: false
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      year: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      notes: {
        type: Sequelize.STRING(500),
        allowNull: true
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP')
      }
    });

    await queryInterface.addIndex('seasonal_calendar', ['property_id', 'year'], {
      name: 'idx_seasonal_calendar_property_year'
    });

    await queryInterface.addIndex('seasonal_calendar', ['property_id', 'start_date', 'end_date'], {
      name: 'idx_seasonal_calendar_dates'
    });

    console.log('✅ Created seasonal_calendar table');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('seasonal_calendar');
  }
};
