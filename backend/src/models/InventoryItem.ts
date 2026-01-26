import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// InventoryItem attributes interface
interface InventoryItemAttributes {
  id: number;
  week_id: number;
  owner_id: number;
  property_id: number;
  
  // Booking details (denormalized from week)
  start_date: Date | null;
  end_date: Date | null;
  nights: number | null;
  valid_until: Date | null;
  accommodation_type: string;
  season_type: 'RED' | 'WHITE' | 'BLUE';
  
  // Pricing
  credit_price: number;
  credit_price_breakdown: {
    seasonType: string;
    baseValue: number;
    tierMultiplier: number;
    locationMultiplier: number;
    roomTypeMultiplier: number;
    propertyName?: string;
    propertyTier?: string;
    roomType?: string;
  } | null;
  
  // Status
  status: 'available' | 'reserved' | 'sold' | 'expired' | 'withdrawn';
  
  // Reservation tracking
  reserved_by: number | null;
  reserved_at: Date | null;
  reservation_expires_at: Date | null;
  
  // Booking tracking
  booked_by: number | null;
  booking_id: number | null;
  booked_at: Date | null;
  
  // Metadata
  released_at: Date;
  withdrawn_at: Date | null;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Optional fields for creation
interface InventoryItemCreationAttributes extends Optional<InventoryItemAttributes, 
  'id' | 'reserved_by' | 'reserved_at' | 'reservation_expires_at' | 
  'booked_by' | 'booking_id' | 'booked_at' | 'withdrawn_at' | 
  'created_at' | 'updated_at' | 'released_at' | 'credit_price_breakdown' |
  'start_date' | 'end_date' | 'nights' | 'valid_until'
> {}

class InventoryItem extends Model<InventoryItemAttributes, InventoryItemCreationAttributes> 
  implements InventoryItemAttributes {
  
  public id!: number;
  public week_id!: number;
  public owner_id!: number;
  public property_id!: number;
  
  public start_date!: Date | null;
  public end_date!: Date | null;
  public nights!: number | null;
  public valid_until!: Date | null;
  public accommodation_type!: string;
  public season_type!: 'RED' | 'WHITE' | 'BLUE';
  
  public credit_price!: number;
  public credit_price_breakdown!: {
    seasonType: string;
    baseValue: number;
    tierMultiplier: number;
    locationMultiplier: number;
    roomTypeMultiplier: number;
    propertyName?: string;
    propertyTier?: string;
    roomType?: string;
  } | null;
  
  public status!: 'available' | 'reserved' | 'sold' | 'expired' | 'withdrawn';
  
  public reserved_by!: number | null;
  public reserved_at!: Date | null;
  public reservation_expires_at!: Date | null;
  
  public booked_by!: number | null;
  public booking_id!: number | null;
  public booked_at!: Date | null;
  
  public released_at!: Date;
  public withdrawn_at!: Date | null;
  
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Helper methods
  public isAvailable(): boolean {
    return this.status === 'available';
  }

  public isReserved(): boolean {
    return this.status === 'reserved' && 
           this.reservation_expires_at !== null &&
           new Date(this.reservation_expires_at) > new Date();
  }

  public hasExpiredReservation(): boolean {
    return this.status === 'reserved' && 
           this.reservation_expires_at !== null &&
           new Date(this.reservation_expires_at) <= new Date();
  }

  public isFloatingWeek(): boolean {
    return this.start_date === null && this.nights !== null;
  }

  public isFixedWeek(): boolean {
    return this.start_date !== null && this.end_date !== null;
  }
}

InventoryItem.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  week_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    unique: true,
    references: {
      model: 'weeks',
      key: 'id'
    }
  },
  owner_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  property_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'properties',
      key: 'id'
    }
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  nights: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  accommodation_type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  season_type: {
    type: DataTypes.ENUM('RED', 'WHITE', 'BLUE'),
    allowNull: false,
  },
  credit_price: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  credit_price_breakdown: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('available', 'reserved', 'sold', 'expired', 'withdrawn'),
    allowNull: false,
    defaultValue: 'available',
  },
  reserved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  reserved_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reservation_expires_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  booked_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id'
    }
  },
  booked_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  released_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  withdrawn_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
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
}, {
  sequelize,
  modelName: 'InventoryItem',
  tableName: 'inventory_items',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default InventoryItem;
