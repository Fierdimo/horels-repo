import { Model, DataTypes, Sequelize, Association } from 'sequelize';
import TimeshareProperty from './TimeshareProperty';
import WeekAllocation from './WeekAllocation';

/**
 * V2Booking Model (V2)
 * 
 * Unified booking table for both timeshare and hotel reservations.
 * Source field determines the type (TIMESHARE vs HOTEL_PMS).
 * 
 * Key Differences:
 * - Timeshare: 100% margin, no platform_cost, linked to week_allocation
 * - Hotel: 30% margin, platform_cost > 0, no week_allocation link
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Section "bookings"
 */
class V2Booking extends Model {
  public id!: number;
  public confirmation_code!: string;
  
  // Relationships
  public guest_id!: number | null; // FK to users (INT not UNSIGNED), null for guest checkout
  public property_id!: number;
  public week_allocation_id!: number | null;
  
  // Dates
  public check_in!: Date;
  public check_out!: Date;
  public nights!: number;
  
  // Guest Details (cached to avoid JOINs)
  public guest_name!: string;
  public guest_email!: string;
  public guest_phone!: string | null;
  public number_of_guests!: number;
  
  // Room Details
  public room_category!: string;
  public physical_room!: string | null;
  
  // Source Type
  public source!: 'TIMESHARE' | 'HOTEL_PMS';
  
  // Payment
  public credits_used!: number;
  public cash_paid!: number;
  public currency!: string;
  
  // Platform Economics
  public platform_cost!: number;
  public platform_revenue!: number;
  public margin_percent!: number;
  
  // Status
  public status!: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'CHECKED_OUT' | 'CANCELLED' | 'NO_SHOW';
  public cancellation_reason!: string | null;
  public cancelled_at!: Date | null;
  
  // PMS Integration
  public pms_provider!: string | null;
  public pms_booking_id!: string | null;
  public pms_status!: string | null;
  public pms_last_sync!: Date | null;
  
  // Special Requests
  public special_requests!: string | null;
  public internal_notes!: string | null;
  
  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  
  // Associations
  public readonly property?: TimeshareProperty;
  public readonly weekAllocation?: WeekAllocation;
  
  public static associations: {
    property: Association<V2Booking, TimeshareProperty>;
    weekAllocation: Association<V2Booking, WeekAllocation>;
  };
  
  /**
   * Check if booking is for timeshare
   */
  public isTimeshare(): boolean {
    return this.source === 'TIMESHARE';
  }
  
  /**
   * Check if booking is for hotel
   */
  public isHotel(): boolean {
    return this.source === 'HOTEL_PMS';
  }
  
  /**
   * Check if booking is cancellable
   */
  public isCancellable(): boolean {
    return ['PENDING', 'CONFIRMED'].includes(this.status) && new Date(this.check_in) > new Date();
  }
  
  /**
   * Calculate total cost in credits
   */
  public getTotalCredits(): number {
    return parseFloat(this.credits_used.toString()) + (parseFloat(this.cash_paid.toString()) / 1); // Assuming 1:1 credit:cash ratio
  }
  
  /**
   * Get booking duration in nights
   */
  public getDuration(): number {
    const checkIn = new Date(this.check_in);
    const checkOut = new Date(this.check_out);
    const diffTime = checkOut.getTime() - checkIn.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export function initV2Booking(sequelize: Sequelize): typeof V2Booking {
  V2Booking.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      booking_code: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'e.g., "BRM-5001-2026"',
        field: 'confirmation_code',
      },
      
      // Relationships
      guest_id: {
        type: DataTypes.INTEGER, // INT(11) to match users.id
        allowNull: true, // Allow guest checkout without account
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      property_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'timeshare_properties',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      week_allocation_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'week_allocations',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'NULL for hotel bookings',
      },
      
      // Dates
      check_in: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      check_out: {
        type: DataTypes.DATEONLY,
        allowNull: false,
      },
      nights: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
      },
      
      // Guest Details (cached)
      guest_name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Cached from users table',
      },
      guest_email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Cached from users table',
      },
      guest_phone: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Cached from users table',
      },
      number_of_guests: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        field: 'guests',
      },
      
      // Room Details
      room_category: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'e.g., "2BR Oceanview" - NOT room number',
      },
      physical_room: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Room number assigned by PMS',
      },
      
      // Source Type
      source: {
        type: DataTypes.ENUM('TIMESHARE', 'HOTEL_PMS'),
        allowNull: false,
      },
      
      // Payment
      credits_used: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      cash_paid: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: false,
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'EUR',
        allowNull: false,
      },
      
      // Platform Economics
      platform_cost: {
        type: DataTypes.DECIMAL(10, 2),
        defaultValue: 0.00,
        allowNull: false,
        comment: 'What we pay hotel (0 for timeshare)',
      },
      platform_revenue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'What we earn (credits_used + cash_paid)',
      },
      margin_percent: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: false,
        comment: '100% for timeshare, ~30% for hotel',
      },
      
      // Status
      status: {
        type: DataTypes.ENUM('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW'),
        defaultValue: 'PENDING',
        allowNull: false,
      },
      cancellation_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      cancelled_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      
      // PMS Integration
      pms_provider: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'mews, cloudbeds, opera',
      },
      pms_booking_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'PMS provider booking reference',
      },
      pms_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Status from PMS',
      },
      pms_last_sync: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last PMS sync timestamp',
      },
      
      // Special Requests
      special_requests: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      internal_notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Staff notes, not visible to guest',
      },
      
      // Timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'v2_bookings',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'idx_booking_code',
          fields: ['booking_code'],
          unique: true,
        },
        {
          name: 'idx_guest',
          fields: ['guest_id', 'status'],
        },
        {
          name: 'idx_property_dates',
          fields: ['property_id', 'check_in', 'check_out'],
        },
        {
          name: 'idx_source',
          fields: ['source', 'status'],
        },
        {
          name: 'idx_week_allocation',
          fields: ['week_allocation_id'],
        },
      ],
    }
  );

  return V2Booking;
}

export default V2Booking;
