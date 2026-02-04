import { Model, DataTypes, Sequelize, Association } from 'sequelize';
import Ownership from './Ownership';
import V2Booking from './V2Booking';

/**
 * WeekAllocation Model (V2)
 * 
 * ⚠️ HOT TABLE - Most queried table in the system
 * 
 * Annual week assignments for ownerships. Status lifecycle:
 * ASSIGNED → RESERVED (owner self-use) | RELEASED (converted to credits) → BOOKED (guest) → USED
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Section "week_allocations"
 * See: docs_v2/DATABASE_DESIGN.md - Hot Table Optimization
 */
class WeekAllocation extends Model {
  public id!: number;
  public ownership_id!: number;
  
  // Week Identification
  public year!: number;
  public week_number!: number | null;
  public start_date!: Date;
  public end_date!: Date;
  
  // Status Lifecycle
  public status!: 'ASSIGNED' | 'RESERVED' | 'RELEASED' | 'BOOKED' | 'USED' | 'EXPIRED';
  
  // Release Details (populated when RELEASED)
  public released_at!: Date | null;
  public credits_issued!: number | null;
  public release_credit_calc!: object | null; // JSON calculation details
  
  // Booking Details (populated when BOOKED/USED)
  public booking_id!: number | null;
  public booked_by!: number | null; // FK to users
  public booked_at!: Date | null;
  
  // PMS Integration
  public pms_booking_id!: string | null;
  public pms_booking_status!: string | null;
  public physical_room_assigned!: string | null;
  public pms_last_sync!: Date | null;
  
  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  
  // Associations
  public readonly ownership?: Ownership;
  public readonly booking?: V2Booking;
  
  public static associations: {
    ownership: Association<WeekAllocation, Ownership>;
    booking: Association<WeekAllocation, V2Booking>;
  };
  
  /**
   * Check if week is available for booking
   */
  public isAvailable(): boolean {
    return this.status === 'RELEASED' && new Date(this.start_date) > new Date();
  }
  
  /**
   * Check if week is in the past
   */
  public isExpired(): boolean {
    return new Date(this.end_date) < new Date();
  }
  
  /**
   * Calculate days until check-in
   */
  public daysUntilCheckIn(): number {
    const now = new Date();
    const checkIn = new Date(this.start_date);
    const diffTime = checkIn.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  }
}

export function initWeekAllocation(sequelize: Sequelize): typeof WeekAllocation {
  WeekAllocation.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      ownership_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'ownerships',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      
      // Week Identification
      year: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        comment: '2026, 2027, etc.',
      },
      week_number: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: true,
        comment: '1-52, NULL for date-specific allocations',
      },
      start_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Check-in date',
      },
      end_date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Check-out date',
      },
      
      // Status Lifecycle
      status: {
        type: DataTypes.ENUM('ASSIGNED', 'RESERVED', 'RELEASED', 'BOOKED', 'USED', 'EXPIRED'),
        defaultValue: 'ASSIGNED',
        allowNull: false,
      },
      
      // Release Details
      released_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      credits_issued: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Credits given to owner when released',
      },
      release_credit_calc: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'JSON details of credit calculation',
      },
      
      // Booking Details
      booking_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'FK to v2_bookings (circular reference)',
      },
      booked_by: {
        type: DataTypes.INTEGER, // INT(11) to match users.id
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      booked_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      
      // PMS Integration
      pms_booking_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'PMS provider booking reference',
      },
      pms_booking_status: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Status from PMS',
      },
      physical_room_assigned: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'Room number assigned by PMS',
      },
      pms_last_sync: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last sync with PMS',
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
      tableName: 'week_allocations',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'idx_ownership',
          fields: ['ownership_id'],
        },
        {
          name: 'idx_year_status',
          fields: ['year', 'status'],
        },
        {
          name: 'idx_search_released',
          fields: ['status', 'start_date', 'end_date'],
        },
        {
          name: 'idx_owner_year',
          fields: ['ownership_id', 'year'],
        },
        {
          name: 'idx_booking',
          fields: ['booking_id'],
        },
        {
          name: 'unique_ownership_year_week',
          fields: ['ownership_id', 'year', 'week_number'],
          unique: true,
        },
      ],
    }
  );

  return WeekAllocation;
}

export default WeekAllocation;
