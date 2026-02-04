import { Model, DataTypes, Sequelize, Association } from 'sequelize';
import TimeshareProperty from './TimeshareProperty';

/**
 * HotelInventory Model (V2)
 * 
 * Cache table for PMS availability. Data has 24-hour TTL.
 * Used to speed up unified search without hitting PMS API every time.
 * 
 * Background job should:
 * 1. Sync availability daily
 * 2. Delete entries older than 24 hours
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Section "hotel_inventory"
 */
class HotelInventory extends Model {
  public id!: number;
  public property_id!: number;
  
  // Date & Room
  public date!: Date;
  public room_category!: string;
  
  // Availability
  public available_rooms!: number;
  public total_rooms!: number;
  
  // Pricing
  public rate!: number;
  public currency!: string;
  public min_nights!: number | null;
  
  // Cache Metadata
  public last_synced!: Date;
  public pms_provider!: string | null;
  
  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  
  // Associations
  public readonly property?: TimeshareProperty;
  
  public static associations: {
    property: Association<HotelInventory, TimeshareProperty>;
  };
  
  /**
   * Check if cache is stale (older than 24 hours)
   */
  public isStale(): boolean {
    const now = new Date();
    const lastSync = new Date(this.last_synced);
    const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);
    return hoursSinceSync > 24;
  }
  
  /**
   * Check if rooms are available
   */
  public hasAvailability(): boolean {
    return this.available_rooms > 0;
  }
  
  /**
   * Get occupancy rate as percentage
   */
  public getOccupancyRate(): number {
    if (this.total_rooms === 0) return 0;
    return ((this.total_rooms - this.available_rooms) / this.total_rooms) * 100;
  }
}

export function initHotelInventory(sequelize: Sequelize): typeof HotelInventory {
  HotelInventory.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      property_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'timeshare_properties',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      
      // Date & Room
      date: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        comment: 'Date for availability',
      },
      room_category: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Room type/category',
      },
      
      // Availability
      available_rooms: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      total_rooms: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
        comment: 'Total rooms in this category',
      },
      
      // Pricing
      rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'What we pay hotel per night',
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'EUR',
        allowNull: false,
      },
      min_nights: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: true,
        comment: 'Minimum stay requirement',
      },
      
      // Cache Metadata
      last_synced: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        comment: 'When this data was fetched from PMS',
      },
      pms_provider: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'Source PMS system',
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
      tableName: 'hotel_inventory',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'idx_property_date',
          fields: ['property_id', 'date', 'room_category'],
        },
        {
          name: 'idx_date',
          fields: ['date'],
        },
        {
          name: 'idx_availability',
          fields: ['date', 'available_rooms'],
        },
        {
          name: 'unique_property_date_category',
          fields: ['property_id', 'date', 'room_category'],
          unique: true,
        },
      ],
    }
  );

  return HotelInventory;
}

export default HotelInventory;
