'use strict';

/**
 * V2 Migration 3: Create timeshare_units table
 * 
 * Unit categories (NOT physical rooms). Represents types of timeshare ownership.
 * See: docs_v2/DATABASE_DESIGN.md - Section "timeshare_units"
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('timeshare_units', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
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
        onDelete: 'RESTRICT'
      },
      
      // Unit Configuration
      category: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'e.g., "Studio", "1BR Ocean", "2BR Premium"'
      },
      slug: {
        type: Sequelize.STRING(150),
        allowNull: false,
        comment: 'URL-friendly: "studio", "1br-ocean"'
      },
      capacity_min: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 1
      },
      capacity_max: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false,
        comment: 'Maximum occupancy'
      },
      quantity: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: false,
        comment: 'How many physical rooms of this category exist'
      },
      
      // Physical Attributes
      bedrooms: {
        type: Sequelize.TINYINT.UNSIGNED,
        defaultValue: 0
      },
      bathrooms: {
        type: Sequelize.DECIMAL(2, 1),
        defaultValue: 1.0,
        comment: '1.5 = 1 full + 1 half bath'
      },
      size_sqm: {
        type: Sequelize.SMALLINT.UNSIGNED,
        allowNull: true,
        comment: 'Size in square meters'
      },
      floor_range: {
        type: Sequelize.STRING(50),
        allowNull: true,
        comment: 'e.g., "3-8", "Ground"'
      },
      
      // Pricing/Credits
      base_credit_value: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Base credit value before seasonal multipliers'
      },
      seasonal_factors: {
        type: Sequelize.JSON,
        allowNull: false,
        comment: 'Week-by-week multipliers: {1: 0.8, 2: 0.8, ..., 25: 1.5}'
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR'
      },
      
      // Amenities & Details
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      amenities: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: '["Kitchen", "Balcony", "Ocean View"]'
      },
      images: {
        type: Sequelize.JSON,
        allowNull: true
      },
      view_type: {
        type: Sequelize.ENUM('OCEAN', 'POOL', 'GARDEN', 'CITY', 'MOUNTAIN', 'NO_VIEW'),
        defaultValue: 'NO_VIEW'
      },
      
      // Status
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
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

    // Unique constraint: one category per property
    await queryInterface.addConstraint('timeshare_units', {
      fields: ['property_id', 'category'],
      type: 'unique',
      name: 'unique_property_category'
    });

    // Indexes
    await queryInterface.addIndex('timeshare_units', ['property_id', 'is_active'], {
      name: 'idx_property_active'
    });
    
    await queryInterface.addIndex('timeshare_units', ['capacity_max'], {
      name: 'idx_capacity',
      comment: 'Filter by guest count'
    });
    
    await queryInterface.addIndex('timeshare_units', ['category'], {
      name: 'idx_category'
    });
    
    await queryInterface.addIndex('timeshare_units', ['base_credit_value'], {
      name: 'idx_credits',
      comment: 'Sort by price'
    });

    console.log('✅ Created timeshare_units table with indexes');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('timeshare_units');
  }
};
