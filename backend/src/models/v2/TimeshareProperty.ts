import { Model, DataTypes, Sequelize, Association } from 'sequelize';
import TimeshareUnit from './TimeshareUnit';
import V2Booking from './V2Booking';
import HotelInventory from './HotelInventory';

/**
 * TimeshareProperty Model (V2)
 * 
 * Master data for timeshare properties. Each property contains multiple units.
 * Includes PMS integration credentials and geolocation for search.
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Section "timeshare_properties"
 */
class TimeshareProperty extends Model {
  public id!: number;
  public name!: string;
  public slug!: string;
  public city!: string;
  public region!: string | null;
  public country!: string;
  public address!: string | null;
  public postal_code!: string | null;
  public latitude!: number | null;
  public longitude!: number | null;
  
  // PMS Integration
  public pms_provider!: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other';
  public pms_property_id!: string | null;
  public pms_credentials_encrypted!: Buffer | null;
  public pms_last_sync!: Date | null;
  public pms_sync_status!: 'OK' | 'ERROR' | 'DISABLED' | null;
  
  // Program Type
  public program_type!: 'FIXED_WEEK' | 'FLOATING' | 'POINTS';
  public weeks_per_year!: number; // Typically 52
  public check_in_day!: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY' | null;
  
  // Metadata
  public description!: string | null;
  public amenities!: string | null; // JSON stored as text
  public policies!: string | null; // JSON stored as text
  public images!: string | null; // JSON stored as text
  
  // Status
  public is_active!: boolean;
  public is_marketplace_enabled!: boolean;
  
  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  
  // Associations
  public readonly units?: TimeshareUnit[];
  public readonly bookings?: V2Booking[];
  public readonly inventory?: HotelInventory[];
  
  public static associations: {
    units: Association<TimeshareProperty, TimeshareUnit>;
    bookings: Association<TimeshareProperty, V2Booking>;
    inventory: Association<TimeshareProperty, HotelInventory>;
  };
}

export function initTimeshareProperty(sequelize: Sequelize): typeof TimeshareProperty {
  TimeshareProperty.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      slug: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        comment: 'URL-friendly identifier',
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      region: {
        type: DataTypes.STRING(100),
        allowNull: true,
        comment: 'State/Province/Region',
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      address: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      postal_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
        comment: 'For geo search',
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
        comment: 'For geo search',
      },
      
      // PMS Integration
      pms_provider: {
        type: DataTypes.ENUM('mews', 'cloudbeds', 'opera', 'resnexus', 'other'),
        allowNull: false,
      },
      pms_property_id: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'External PMS property identifier',
      },
      pms_credentials_encrypted: {
        type: DataTypes.BLOB,
        allowNull: true,
        comment: 'Encrypted PMS credentials',
      },
      pms_last_sync: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Last successful sync with PMS',
      },
      pms_sync_status: {
        type: DataTypes.ENUM('OK', 'ERROR', 'DISABLED'),
        allowNull: true,
        defaultValue: 'OK',
      },
      
      // Program Type
      program_type: {
        type: DataTypes.ENUM('FIXED_WEEK', 'FLOATING', 'POINTS'),
        allowNull: false,
      },
      weeks_per_year: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: true,
        defaultValue: 52,
        comment: 'Number of weeks in a year (typically 52)',
      },
      check_in_day: {
        type: DataTypes.ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'),
        allowNull: true,
        defaultValue: 'SATURDAY',
        comment: 'Day of week for check-in',
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
      policies: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'JSON object with property policies',
      },
      images: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'JSON array of image URLs',
      },
      
      // Status
      is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      is_marketplace_enabled: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
        comment: 'Whether property appears in marketplace search',
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
      tableName: 'timeshare_properties',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'idx_location',
          fields: ['city', 'country'],
        },
        {
          name: 'idx_coordinates',
          fields: ['latitude', 'longitude'],
        },
        {
          name: 'idx_pms',
          fields: ['pms_provider', 'pms_property_id'],
        },
        {
          name: 'idx_program',
          fields: ['program_type', 'is_active'],
        },
      ],
    }
  );

  return TimeshareProperty;
}

export default TimeshareProperty;
