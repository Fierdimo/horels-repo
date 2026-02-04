'use strict';

/**
 * V2 Migration 9: Create hotel_inventory table
 * 
 * Cache layer for PMS availability. Avoids hitting PMS API on every search.
 * See: docs_v2/DATABASE_DESIGN.md - Section "hotel_inventory"
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('hotel_inventory', {
      id: {
        type: Sequelize.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
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
      
      // Date & Room
      date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      room_category: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      
      // Availability
      total_rooms: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false
      },
      available_rooms: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false
      },
      rate: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'What we pay hotel per night'
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR'
      },
      
      // Cache Metadata
      last_synced: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
      },
      source: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'PMS_API, MANUAL, etc.'
      },
      is_stale: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        comment: 'Flag for background refresh'
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    // Unique constraint: one entry per property/date/category
    await queryInterface.addConstraint('hotel_inventory', {
      fields: ['property_id', 'date', 'room_category'],
      type: 'unique',
      name: 'unique_property_date_category'
    });

    // Indexes
    await queryInterface.addIndex('hotel_inventory', ['date', 'available_rooms'], {
      name: 'idx_date_available',
      comment: 'Search availability'
    });
    
    await queryInterface.addIndex('hotel_inventory', ['is_stale', 'last_synced'], {
      name: 'idx_stale',
      comment: 'Refresh stale cache'
    });
    
    await queryInterface.addIndex('hotel_inventory', ['property_id', 'date'], {
      name: 'idx_property_date'
    });

    console.log('✅ Created hotel_inventory table (PMS cache)');
    console.log('💡 Remember to set up TTL cleanup job: DELETE WHERE date < NOW() - 1 DAY');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('hotel_inventory');
  }
};
