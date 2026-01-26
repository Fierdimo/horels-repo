'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('inventory_items', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
      },
      week_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          model: 'weeks',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
        comment: 'Week that was released to inventory'
      },
      owner_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Owner who released the week'
      },
      property_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'properties',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: 'Property (denormalized for search performance)'
      },
      
      // Booking details (denormalized from week for fast search)
      start_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Start date (null for floating weeks)'
      },
      end_date: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'End date (null for floating weeks)'
      },
      nights: {
        type: Sequelize.INTEGER,
        allowNull: true,
        comment: 'Number of nights (for floating weeks)'
      },
      valid_until: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'Expiration date for floating weeks'
      },
      accommodation_type: {
        type: Sequelize.STRING,
        allowNull: false,
        comment: 'Type: studio, 1bedroom, suite, etc.'
      },
      season_type: {
        type: Sequelize.ENUM('RED', 'WHITE', 'BLUE'),
        allowNull: false,
        comment: 'Season classification'
      },
      
      // Pricing
      credit_price: {
        type: Sequelize.INTEGER,
        allowNull: false,
        comment: 'Price in credits (calculated at release time)'
      },
      credit_price_breakdown: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Detailed breakdown of how price was calculated'
      },
      
      // Inventory status
      status: {
        type: Sequelize.ENUM(
          'available',      // Available for booking
          'reserved',       // Temporarily reserved during checkout
          'sold',          // Booked by someone
          'expired',       // Valid_until passed
          'withdrawn'      // Owner withdrew from inventory
        ),
        allowNull: false,
        defaultValue: 'available',
        comment: 'Current inventory status'
      },
      
      // Reservation tracking
      reserved_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who temporarily reserved this item'
      },
      reserved_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When reservation started'
      },
      reservation_expires_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When temporary reservation expires'
      },
      
      // Booking tracking
      booked_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'User who booked this week'
      },
      booking_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          model: 'bookings',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Associated booking record'
      },
      booked_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When booking was confirmed'
      },
      
      // Metadata
      released_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
        comment: 'When week was released to inventory'
      },
      withdrawn_at: {
        type: Sequelize.DATE,
        allowNull: true,
        comment: 'When/if owner withdrew from inventory'
      },
      
      // Timestamps
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW')
      }
    });

    // Indexes for fast search
    await queryInterface.addIndex('inventory_items', ['status'], {
      name: 'idx_inventory_status'
    });

    await queryInterface.addIndex('inventory_items', ['property_id', 'status'], {
      name: 'idx_inventory_property_status'
    });

    await queryInterface.addIndex('inventory_items', ['start_date', 'end_date', 'status'], {
      name: 'idx_inventory_dates_status'
    });

    await queryInterface.addIndex('inventory_items', ['season_type', 'status'], {
      name: 'idx_inventory_season_status'
    });

    await queryInterface.addIndex('inventory_items', ['accommodation_type', 'status'], {
      name: 'idx_inventory_accommodation_status'
    });

    await queryInterface.addIndex('inventory_items', ['credit_price', 'status'], {
      name: 'idx_inventory_price_status'
    });

    await queryInterface.addIndex('inventory_items', ['reserved_by'], {
      name: 'idx_inventory_reserved_by'
    });

    await queryInterface.addIndex('inventory_items', ['booked_by'], {
      name: 'idx_inventory_booked_by'
    });

    // Composite index for complex queries
    await queryInterface.addIndex('inventory_items', 
      ['status', 'property_id', 'season_type', 'accommodation_type', 'start_date'],
      {
        name: 'idx_inventory_search_composite'
      }
    );
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('inventory_items');
  }
};
