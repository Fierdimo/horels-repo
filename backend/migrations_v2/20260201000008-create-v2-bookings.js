'use strict';

/**
 * V2 Migration 8: Create v2_bookings table
 * 
 * Unified bookings table for both timeshare and hotel reservations.
 * See: docs_v2/DATABASE_DESIGN.md - Section "bookings"
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('v2_bookings', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      confirmation_code: {
        type: Sequelize.STRING(20),
        allowNull: false,
        unique: true,
        comment: 'e.g., "BRM-5001-2026"'
      },
      
      // Relationships
      guest_id: {
        type: Sequelize.INTEGER.UNSIGNED, // Match users.id type
        allowNull: false,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
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
      week_allocation_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'week_allocations',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'NULL if hotel booking'
      },
      
      // Dates
      check_in: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      check_out: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      nights: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
      },
      guests: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: false
      },
      
      // Room Details
      room_category: {
        type: Sequelize.STRING(100),
        allowNull: false,
        comment: 'Unit category booked'
      },
      physical_room: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Assigned by PMS later'
      },
      
      // Source Type (for margin calculation)
      source: {
        type: Sequelize.ENUM('TIMESHARE', 'HOTEL_PMS'),
        allowNull: false
      },
      
      // Payment Details
      credits_used: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      cash_paid: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00
      },
      currency: {
        type: Sequelize.STRING(3),
        allowNull: false,
        defaultValue: 'EUR'
      },
      payment_status: {
        type: Sequelize.ENUM('PENDING', 'COMPLETED', 'REFUNDED'),
        defaultValue: 'PENDING'
      },
      
      // Platform Economics
      platform_cost: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'What we pay (0 for timeshare, hotel rate for hotel)'
      },
      platform_revenue: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        comment: 'What we earn'
      },
      margin_percent: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: false,
        comment: '100% for timeshare, ~30% for hotel'
      },
      
      // Status Lifecycle
      status: {
        type: Sequelize.ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'),
        allowNull: false,
        defaultValue: 'PENDING'
      },
      cancellation_reason: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      cancelled_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      // PMS Integration
      pms_booking_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'External PMS reservation ID'
      },
      pms_provider: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      pms_status: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      pms_last_sync: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      // Guest Details (cached for performance)
      guest_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        comment: 'Cached to avoid JOIN'
      },
      guest_email: {
        type: Sequelize.STRING(255),
        allowNull: false
      },
      guest_phone: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      
      // Special Requests
      special_requests: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      internal_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
        comment: 'Staff only'
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
      },
      confirmed_at: {
        type: Sequelize.DATE,
        allowNull: true
      }
    }, {
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci'
    });

    // Add foreign key to week_allocations.booking_id (circular dependency resolution)
    await queryInterface.addConstraint('week_allocations', {
      fields: ['booking_id'],
      type: 'foreign key',
      name: 'fk_week_allocations_booking',
      references: {
        table: 'v2_bookings',
        field: 'id'
      },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE'
    });

    // Indexes
    await queryInterface.addIndex('v2_bookings', ['guest_id', 'status'], {
      name: 'idx_guest'
    });
    
    await queryInterface.addIndex('v2_bookings', ['property_id', 'check_in', 'check_out'], {
      name: 'idx_property_dates'
    });
    
    await queryInterface.addIndex('v2_bookings', ['check_in', 'status'], {
      name: 'idx_check_in',
      comment: 'Daily check-in report'
    });
    
    await queryInterface.addIndex('v2_bookings', ['check_out', 'status'], {
      name: 'idx_check_out',
      comment: 'Daily check-out report'
    });
    
    await queryInterface.addIndex('v2_bookings', ['status', 'created_at'], {
      name: 'idx_status'
    });
    
    await queryInterface.addIndex('v2_bookings', ['source', 'status'], {
      name: 'idx_source',
      comment: 'Revenue reports by source'
    });
    
    await queryInterface.addIndex('v2_bookings', ['confirmation_code'], {
      name: 'idx_confirmation',
      unique: true
    });
    
    await queryInterface.addIndex('v2_bookings', ['pms_provider', 'pms_booking_id'], {
      name: 'idx_pms'
    });

    console.log('✅ Created v2_bookings table with indexes');
    console.log('✅ Added circular FK to week_allocations.booking_id');
  },

  down: async (queryInterface, Sequelize) => {
    // Remove circular FK first
    await queryInterface.removeConstraint('week_allocations', 'fk_week_allocations_booking');
    await queryInterface.dropTable('v2_bookings');
  }
};
