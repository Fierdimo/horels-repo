'use strict';

/**
 * V2 Migration 5: Create week_allocations table
 * 
 * ⚠️ HOT TABLE - Most queried table in the system
 * Weekly inventory for timeshare. This table is heavily optimized for search performance.
 * 
 * See: docs_v2/DATABASE_DESIGN.md - Section "week_allocations"
 */

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.createTable('week_allocations', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true
      },
      ownership_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'ownerships',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT'
      },
      
      // Week Identification
      year: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false
      },
      week_number: {
        type: Sequelize.TINYINT.UNSIGNED,
        allowNull: true,
        comment: '1-52, NULL for date-specific allocations'
      },
      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false
      },
      
      // Status Lifecycle (ordered by frequency for enum optimization)
      status: {
        type: Sequelize.ENUM(
          'ASSIGNED',   // 1: Owner has it (most common)
          'RESERVED',   // 2: Owner booked for self
          'RELEASED',   // 3: Converted to credits (PUBLIC INVENTORY)
          'BOOKED',     // 4: Someone else booked
          'USED',       // 5: Checked out
          'EXPIRED'     // 6: Past, unused
        ),
        allowNull: false,
        defaultValue: 'ASSIGNED'
      },
      
      // Release Details (populated when status = RELEASED)
      released_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      credits_issued: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Credits given to owner when released'
      },
      release_credit_calc: {
        type: Sequelize.JSON,
        allowNull: true,
        comment: 'Audit trail: {base, seasonal, timing, final}'
      },
      
      // Booking Details (populated when status = BOOKED/USED)
      booking_id: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'FK to bookings table'
      },
      booked_by: {
        type: Sequelize.INTEGER, // Match users.id type (signed int)
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      },
      booked_at: {
        type: Sequelize.DATE,
        allowNull: true
      },
      
      // PMS Tracking
      pms_booking_id: {
        type: Sequelize.STRING(255),
        allowNull: true,
        comment: 'External PMS reservation ID'
      },
      pms_booking_status: {
        type: Sequelize.STRING(50),
        allowNull: true
      },
      physical_room_assigned: {
        type: Sequelize.STRING(100),
        allowNull: true,
        comment: 'Room number assigned by PMS'
      },
      pms_last_sync: {
        type: Sequelize.DATE,
        allowNull: true
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

    // Unique constraint: one allocation per ownership per week
    await queryInterface.addConstraint('week_allocations', {
      fields: ['ownership_id', 'year', 'week_number'],
      type: 'unique',
      name: 'unique_ownership_year_week'
    });

    // Foreign key for booking_id (added separately to avoid circular dependency)
    // Will be added in bookings migration after bookings table is created

    // CRITICAL INDEXES FOR PERFORMANCE
    
    // 1. Main search query: find RELEASED weeks by date range
    await queryInterface.addIndex('week_allocations', ['status', 'start_date', 'end_date'], {
      name: 'idx_search_released',
      comment: 'CRITICAL: Main unified search query'
    });
    
    // 2. Owner dashboard: show my weeks
    await queryInterface.addIndex('week_allocations', ['ownership_id', 'year', 'status'], {
      name: 'idx_owner_year'
    });
    
    // 3. Booking lookup
    await queryInterface.addIndex('week_allocations', ['booking_id'], {
      name: 'idx_booking'
    });
    
    await queryInterface.addIndex('week_allocations', ['booked_by', 'status'], {
      name: 'idx_booked_by'
    });
    
    // 4. Date range queries (availability calendar)
    await queryInterface.addIndex('week_allocations', ['start_date', 'end_date', 'status'], {
      name: 'idx_dates'
    });
    
    // 5. Expired week cleanup job
    await queryInterface.addIndex('week_allocations', ['end_date', 'status'], {
      name: 'idx_expired',
      comment: 'For nightly cleanup job'
    });
    
    // 6. Composite index for unified search (redundant but optimized for specific query pattern)
    await queryInterface.addIndex('week_allocations', ['status', 'year', 'start_date'], {
      name: 'idx_unified_search',
      comment: 'Optimized for search with year filter'
    });

    console.log('✅ Created week_allocations table with 6+ performance indexes');
    console.log('⚠️  This is a HOT TABLE - all indexes are critical for performance');
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('week_allocations');
  }
};
