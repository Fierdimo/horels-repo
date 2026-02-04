'use strict';

/**
 * V2 Migration 2: Create timeshare_properties table
 * 
 * Property master data for timeshare resorts.
 * See: docs_v2/DATABASE_DESIGN.md - Section "timeshare_properties"
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('timeshare_properties', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      
      // Basic Info
      name: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      slug: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'URL-friendly identifier'
      },
      
      // Location (indexed for search)
      city: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: false
      },
      region: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'e.g., Andalusia, Costa del Sol'
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
        comment: 'For geo-based search'
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
        comment: 'For geo-based search'
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      postal_code: {
        type: Sequelize.STRING(20),
        allowNull: true
      },
      
      // PMS Integration (credentials encrypted at app level)
      pms_provider: {
        type: Sequelize.ENUM('mews', 'cloudbeds', 'opera', 'resnexus', 'other'),
        allowNull: false
      },
      pms_property_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'External PMS property ID'
      },
      pms_credentials_encrypted: {
        type: Sequelize.BLOB,
        allowNull: true,
        comment: 'AES-256 encrypted JSON credentials'
      },
      pms_last_sync: {
        type: Sequelize.DATE,
        allowNull: true
      },
      pms_sync_status: {
        type: Sequelize.ENUM('OK', 'ERROR', 'DISABLED'),
        defaultValue: 'OK'
      },
      
      // Program Configuration
      program_type: {
        type: Sequelize.ENUM('FIXED_WEEK', 'FLOATING', 'POINTS'),
        allowNull: false,
        comment: 'Type of timeshare program'
      },
      weeks_per_year: {
        type: Sequelize.TINYINT.UNSIGNED,
        defaultValue: 52
      },
      check_in_day: {
        type: Sequelize.ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'),
        defaultValue: 'SATURDAY',
        comment: 'Standard check-in day for this property'
      },
      
      // Metadata
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      amenities: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of amenities: ["Pool", "Gym", "Spa"]'
      },
      policies: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Check-in time, cancellation policies, etc.'
      },
      images: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Array of image objects with url, order, caption'
      },
      
      // Status
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      is_marketplace_enabled: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
        comment: 'Can weeks from this property be listed in marketplace?'
      },
      
      // Timestamps
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
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    // Indexes for common queries
    await queryInterface.addIndex('timeshare_properties', ['city', 'country', 'is_active'], {
      name: 'idx_location'
    });
    
    await queryInterface.addIndex('timeshare_properties', ['latitude', 'longitude'], {
      name: 'idx_coordinates'
    });
    
    await queryInterface.addIndex('timeshare_properties', ['pms_provider', 'pms_property_id'], {
      name: 'idx_pms'
    });
    
    await queryInterface.addIndex('timeshare_properties', ['program_type', 'is_active'], {
      name: 'idx_program'
    });

    console.log('✅ Created timeshare_properties table with indexes');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('timeshare_properties');
  }
};
