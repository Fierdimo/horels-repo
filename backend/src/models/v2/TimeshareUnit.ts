import { Model, DataTypes, Sequelize, Association } from 'sequelize';
import TimeshareProperty from './TimeshareProperty';
import Ownership from './Ownership';

/**
 * TimeshareUnit Model (V2)
 * 
 * Unit categories within a property (NOT individual rooms).
 * Example: "2BR Oceanview" represents a category with multiple physical rooms.
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Section "timeshare_units"
 */
class TimeshareUnit extends Model {
  public id!: number;
  public property_id!: number;
  
  // Unit Details
  public category!: string;
  public slug!: string;
  public capacity_min!: number;
  public capacity_max!: number;
  public quantity!: number;
  public bedrooms!: number;
  public bathrooms!: number;
  public size_sqm!: number | null;
  public floor_range!: string | null;
  
  // Pricing
  public base_credit_value!: number;
  public room_type_multiplier!: number | null;
  public seasonal_factors!: string; // JSON stored as text
  public currency!: string;
  
  // Metadata
  public description!: string | null;
  public amenities!: string | null; // JSON stored as text
  public images!: string | null; // JSON stored as text
  public view_type!: 'OCEAN' | 'POOL' | 'GARDEN' | 'CITY' | 'MOUNTAIN' | 'NO_VIEW' | null;
  
  // Status
  public is_active!: boolean;
  
  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  
  // Associations
  public readonly property?: TimeshareProperty;
  public readonly ownerships?: Ownership[];
  
  public static associations: {
    property: Association<TimeshareUnit, TimeshareProperty>;
    ownerships: Association<TimeshareUnit, Ownership>;
  };
}

export function initTimeshareUnit(sequelize: Sequelize): typeof TimeshareUnit {
  TimeshareUnit.init(
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
        onDelete: 'RESTRICT',
      },
      
      // Unit Details
      category: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'e.g., "Studio", "1BR Garden View", "2BR Oceanview"',
      },
      slug: {
        type: DataTypes.STRING(150),
        allowNull: false,
        comment: 'URL-friendly identifier',
      },
      capacity_min: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 1,
        comment: 'Minimum occupancy',
      },
      capacity_max: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        comment: 'Maximum occupancy',
      },
      quantity: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: false,
        comment: 'How many physical rooms of this category exist',
      },
      bedrooms: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: false,
        defaultValue: 0,
      },
      bathrooms: {
        type: DataTypes.DECIMAL(2, 1),
        allowNull: false,
        defaultValue: 1.0,
      },
      size_sqm: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: true,
        comment: 'Size in square meters',
      },
      floor_range: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'e.g., "3-8", "Ground"',
      },
      
      // Pricing
      base_credit_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Base weekly credit value before seasonal adjustment',
      },
      room_type_multiplier: {
        type: DataTypes.DECIMAL(3, 2),
        allowNull: true,
        defaultValue: null,
        comment: 'Manual override for room type multiplier. NULL = auto-detect from category',
      },
      seasonal_factors: {
        type: DataTypes.TEXT('long'),
        allowNull: false,
        comment: 'JSON: Week-by-week multipliers: {summer: 1.2, winter: 0.8}',
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'EUR',
      },
      
      // Metadata
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      amenities: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'JSON array of amenity strings',
      },
      images: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'JSON array of image URLs',
      },
      view_type: {
        type: DataTypes.ENUM('OCEAN', 'POOL', 'GARDEN', 'CITY', 'MOUNTAIN', 'NO_VIEW'),
        allowNull: true,
        defaultValue: 'NO_VIEW',
      },
      
      // Status
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
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
      tableName: 'timeshare_units',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'idx_property_category',
          fields: ['property_id', 'category'],
        },
        {
          name: 'idx_capacity',
          fields: ['capacity_max'],
        },
        {
          name: 'idx_base_credit_value',
          fields: ['base_credit_value'],
        },
      ],
    }
  );

  return TimeshareUnit;
}

export default TimeshareUnit;
