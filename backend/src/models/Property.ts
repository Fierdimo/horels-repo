import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Property attributes interface (matching timeshare_properties table)
interface PropertyAttributes {
  id: number;
  name: string;
  slug: string;
  city: string;
  country: string;
  region?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
  postal_code?: string;
  
  // PMS Integration
  pms_provider: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other';
  pms_property_id?: string;
  pms_credentials_encrypted?: Buffer;
  pms_last_sync?: Date;
  pms_sync_status?: 'OK' | 'ERROR' | 'DISABLED';
  
  // Program configuration
  program_type: 'FIXED_WEEK' | 'FLOATING' | 'POINTS';
  weeks_per_year?: number;
  check_in_day?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  
  // Property information
  description?: string;
  amenities?: string; // JSON string
  policies?: string; // JSON string
  images?: string; // JSON string
  
  // Status
  is_active: boolean;
  is_marketplace_enabled: boolean;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Optional fields for creation
interface PropertyCreationAttributes extends Optional<PropertyAttributes, 
  'id' | 'region' | 'latitude' | 'longitude' | 'address' | 'postal_code' |
  'pms_property_id' | 'pms_credentials_encrypted' | 'pms_last_sync' | 'pms_sync_status' |
  'weeks_per_year' | 'check_in_day' | 'description' | 'amenities' | 'policies' | 'images' |
  'created_at' | 'updated_at'
> {}

class Property extends Model<PropertyAttributes, PropertyCreationAttributes> implements PropertyAttributes {
  public id!: number;
  public name!: string;
  public slug!: string;
  public city!: string;
  public country!: string;
  public region?: string;
  public latitude?: number;
  public longitude?: number;
  public address?: string;
  public postal_code?: string;
  
  // PMS Integration
  public pms_provider!: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other';
  public pms_property_id?: string;
  public pms_credentials_encrypted?: Buffer;
  public pms_last_sync?: Date;
  public pms_sync_status?: 'OK' | 'ERROR' | 'DISABLED';
  
  // Program configuration
  public program_type!: 'FIXED_WEEK' | 'FLOATING' | 'POINTS';
  public weeks_per_year?: number;
  public check_in_day?: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';
  
  // Property information
  public description?: string;
  public amenities?: string;
  public policies?: string;
  public images?: string;
  
  // Status
  public is_active!: boolean;
  public is_marketplace_enabled!: boolean;
  
  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Property.init({
  id: {
    type: DataTypes.INTEGER,
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
    field: 'slug',
  },
  
  // Hotel information
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  amenities: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  // stars: removed - not in timeshare_properties table
  images: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  
  // Contact information - REMOVED (not in timeshare_properties table)
  // contact_phone, contact_email, website don't exist in DB
  
  // Address
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'city',
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'country',
  },
  region: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'region',
  },
  postal_code: {
    type: DataTypes.STRING(20),
    allowNull: true,
  },
  latitude: {
    type: DataTypes.DECIMAL(10, 8),
    allowNull: true,
  },
  longitude: {
    type: DataTypes.DECIMAL(11, 8),
    allowNull: true,
  },
  
  // PMS Integration
  pms_provider: {
    type: DataTypes.ENUM('mews', 'cloudbeds', 'resnexus', 'opera', 'none'),
    defaultValue: 'none',
    allowNull: false,
  },
  pms_property_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  // pms_credentials renamed to pms_credentials_encrypted in DB
  pms_credentials_encrypted: {
    type: DataTypes.BLOB,
    allowNull: true,
    field: 'pms_credentials_encrypted',
  },
  // pms_config, pms_sync_enabled, pms_verified, pms_verified_at removed - not in DB
  pms_last_sync: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  pms_sync_status: {
    type: DataTypes.ENUM('OK', 'ERROR', 'DISABLED'),
    defaultValue: 'OK',
    allowNull: true,
    field: 'pms_sync_status',
  },
  
  // Program configuration
  program_type: {
    type: DataTypes.ENUM('FIXED_WEEK', 'FLOATING', 'POINTS'),
    allowNull: false,
    field: 'program_type',
  },
  weeks_per_year: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: true,
    defaultValue: 52,
    field: 'weeks_per_year',
  },
  check_in_day: {
    type: DataTypes.ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'),
    allowNull: true,
    defaultValue: 'SATURDAY',
    field: 'check_in_day',
  },
  
  // Payment configuration - REMOVED (not in timeshare_properties)
  // stripe_connect_account_id, bank_account_info, commission_percentage don't exist
  
  // Operational settings - REMOVED (not in timeshare_properties)
  // check_in_time, check_out_time, timezone, languages, cancellation_policy don't exist
  
  // Property status
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
    allowNull: false,
    field: 'is_active',
  },
  // verified_at, verified_by removed - not in timeshare_properties
  
  // Marketplace configuration
  is_marketplace_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
    field: 'is_marketplace_enabled',
  },
  // marketplace_description, marketplace_images, marketplace_amenities, marketplace_enabled_at removed - not in DB
  
  // Credit valuation configuration - REMOVED (not in timeshare_properties)
  // tier, location_multiplier don't exist
  
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
  },
}, {
  sequelize,
  modelName: 'Property',
  tableName: 'timeshare_properties',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  hooks: {
    afterFind: (result: any) => {
      if (!result) return result;
      
      // Helper function to fix location on a single instance
      const fixLocation = (instance: any) => {
        if (!instance) return;
        
        const dataValues = instance.dataValues || instance;
        const location = dataValues.location;
        const city = dataValues.city;
        const country = dataValues.country;
        
        // Fix "undefined, undefined" location
        if (location && (location === 'undefined, undefined' || location.includes('undefined'))) {
          if (city && country) {
            dataValues.location = `${city}, ${country}`;
            if (instance.location !== undefined) instance.location = `${city}, ${country}`;
          } else if (city) {
            dataValues.location = city;
            if (instance.location !== undefined) instance.location = city;
          } else if (country) {
            dataValues.location = country;
            if (instance.location !== undefined) instance.location = country;
          }
        }
      };
      
      // Handle both single instance and array of instances
      if (Array.isArray(result)) {
        result.forEach(fixLocation);
      } else {
        fixLocation(result);
      }
      
      return result;
    }
  }
});

export default Property;