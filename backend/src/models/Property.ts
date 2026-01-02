import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Property attributes interface
interface PropertyAttributes {
  id: number;
  name: string;
  location: string;
  coordinates?: string;
  
  // Hotel information
  description?: string;
  amenities?: string[]; // JSON array
  stars?: number;
  images?: string[]; // JSON array of image URLs
  
  // Contact information
  contact_phone?: string;
  contact_email?: string;
  website?: string;
  
  // Address
  address?: string;
  city?: string;
  country?: string;
  postal_code?: string;
  latitude?: number;
  longitude?: number;
  
  // PMS Integration
  pms_provider: 'mews' | 'cloudbeds' | 'resnexus' | 'opera' | 'none';
  pms_property_id?: string; // ID in external PMS system
  pms_credentials?: string; // Encrypted JSON string
  pms_config?: {
    autoSyncBookings?: boolean;
    syncInterval?: number;
    syncRooms?: boolean;
    syncAvailability?: boolean;
    notifyOnSyncFailure?: boolean;
  };
  pms_sync_enabled: boolean;
  pms_last_sync?: Date;
  pms_sync_status: 'success' | 'failed' | 'pending' | 'never';
  pms_verified: boolean;
  pms_verified_at?: Date;
  
  // Payment configuration
  stripe_connect_account_id?: string;
  bank_account_info?: string; // Encrypted JSON string
  commission_percentage: number;
  
  // Operational settings
  check_in_time?: string;
  check_out_time?: string;
  timezone?: string;
  languages?: string[]; // JSON array of language codes
  cancellation_policy?: string;
  
  // Property status
  status: 'pending_verification' | 'active' | 'inactive' | 'suspended';
  verified_at?: Date;
  verified_by?: number; // User ID
  
  // Marketplace configuration
  is_marketplace_enabled: boolean;
  marketplace_description?: string;
  marketplace_images?: string[];
  marketplace_amenities?: string[];
  marketplace_enabled_at?: Date;
  
  // Credit valuation configuration
  tier: 'DIAMOND' | 'GOLD' | 'SILVER_PLUS' | 'STANDARD';
  location_multiplier: number;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
}

// Optional fields for creation
interface PropertyCreationAttributes extends Optional<PropertyAttributes, 
  'id' | 'coordinates' | 'description' | 'amenities' | 'stars' | 'images' |
  'contact_phone' | 'contact_email' | 'website' |
  'address' | 'city' | 'country' | 'postal_code' | 'latitude' | 'longitude' |
  'pms_property_id' | 'pms_credentials' | 'pms_config' | 'pms_last_sync' | 'pms_verified_at' |
  'stripe_connect_account_id' | 'bank_account_info' |
  'check_in_time' | 'check_out_time' | 'timezone' | 'languages' | 'cancellation_policy' |
  'verified_at' | 'verified_by' |
  'is_marketplace_enabled' | 'marketplace_description' | 'marketplace_images' | 'marketplace_amenities' | 'marketplace_enabled_at' |
  'created_at' | 'updated_at'
> {}

class Property extends Model<PropertyAttributes, PropertyCreationAttributes> implements PropertyAttributes {
  public id!: number;
  public name!: string;
  public location!: string;
  public coordinates?: string;
  
  // Hotel information
  public description?: string;
  public amenities?: string[];
  public stars?: number;
  public images?: string[];
  
  // Contact information
  public contact_phone?: string;
  public contact_email?: string;
  public website?: string;
  
  // Address
  public address?: string;
  public city?: string;
  public country?: string;
  public postal_code?: string;
  public latitude?: number;
  public longitude?: number;
  
  // PMS Integration
  public pms_provider!: 'mews' | 'cloudbeds' | 'resnexus' | 'opera' | 'none';
  public pms_property_id?: string;
  public pms_credentials?: string;
  public pms_config?: {
    autoSyncBookings?: boolean;
    syncInterval?: number;
    syncRooms?: boolean;
    syncAvailability?: boolean;
    notifyOnSyncFailure?: boolean;
  };
  public pms_sync_enabled!: boolean;
  public pms_last_sync?: Date;
  public pms_sync_status!: 'success' | 'failed' | 'pending' | 'never';
  public pms_verified!: boolean;
  public pms_verified_at?: Date;
  
  // Payment configuration
  public stripe_connect_account_id?: string;
  public bank_account_info?: string;
  public commission_percentage!: number;
  
  // Operational settings
  public check_in_time?: string;
  public check_out_time?: string;
  public timezone?: string;
  public languages?: string[];
  public cancellation_policy?: string;
  
  // Property status
  public status!: 'pending_verification' | 'active' | 'inactive' | 'suspended';
  public verified_at?: Date;
  public verified_by?: number;
  
  // Marketplace configuration
  public is_marketplace_enabled!: boolean;
  public marketplace_description?: string;
  public marketplace_images?: string[];
  public marketplace_amenities?: string[];
  public marketplace_enabled_at?: Date;
  
  // Credit valuation configuration
  public tier!: 'DIAMOND' | 'GOLD' | 'SILVER_PLUS' | 'STANDARD';
  public location_multiplier!: number;
  
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
  location: {
    type: DataTypes.STRING(255),
    allowNull: false,
    get() {
      const rawValue = this.getDataValue('location');
      const city = this.getDataValue('city');
      const country = this.getDataValue('country');
      
      // If location is "undefined, undefined" or contains "undefined", try to construct from city/country
      if (rawValue && (rawValue === 'undefined, undefined' || rawValue.includes('undefined'))) {
        // Only try to construct if city and country are actually loaded
        if (city && country) {
          return `${city}, ${country}`;
        } else if (city) {
          return city;
        } else if (country) {
          return country;
        }
        // If city/country not loaded, return original value as-is
        return rawValue;
      }
      
      return rawValue || '';
    }
  },
  coordinates: {
    type: DataTypes.STRING(255),
    allowNull: true,
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
  stars: {
    type: DataTypes.INTEGER,
    allowNull: true,
    validate: {
      min: 1,
      max: 5,
    },
  },
  images: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  
  // Contact information
  contact_phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  contact_email: {
    type: DataTypes.STRING(255),
    allowNull: true,
    validate: {
      isEmail: true,
    },
  },
  website: {
    type: DataTypes.STRING(500),
    allowNull: true,
  },
  
  // Address
  address: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  country: {
    type: DataTypes.STRING(100),
    allowNull: true,
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
  pms_credentials: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  pms_config: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  pms_sync_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  pms_last_sync: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  pms_sync_status: {
    type: DataTypes.ENUM('success', 'failed', 'pending', 'never'),
    defaultValue: 'never',
    allowNull: false,
  },
  pms_verified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  pms_verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  
  // Payment configuration
  stripe_connect_account_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  bank_account_info: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  commission_percentage: {
    type: DataTypes.DECIMAL(5, 2),
    defaultValue: 10.00,
    allowNull: false,
  },
  
  // Operational settings
  check_in_time: {
    type: DataTypes.TIME,
    allowNull: true,
    defaultValue: '15:00:00',
  },
  check_out_time: {
    type: DataTypes.TIME,
    allowNull: true,
    defaultValue: '11:00:00',
  },
  timezone: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'Europe/Madrid',
  },
  languages: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  cancellation_policy: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  
  // Property status
  status: {
    type: DataTypes.ENUM('pending_verification', 'active', 'inactive', 'suspended'),
    defaultValue: 'active',
    allowNull: false,
  },
  verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  verified_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id',
    },
  },
  
  // Marketplace configuration
  is_marketplace_enabled: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },
  marketplace_description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  marketplace_images: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  marketplace_amenities: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  marketplace_enabled_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  
  // Credit valuation configuration
  tier: {
    type: DataTypes.ENUM('DIAMOND', 'GOLD', 'SILVER_PLUS', 'STANDARD'),
    defaultValue: 'STANDARD',
    allowNull: false,
    comment: 'Property tier for credit valuation (DIAMOND=1.5x, GOLD=1.3x, SILVER_PLUS=1.1x, STANDARD=1.0x)',
  },
  location_multiplier: {
    type: DataTypes.DECIMAL(3, 2),
    defaultValue: 1.00,
    allowNull: false,
    validate: {
      min: 0.5,
      max: 3.0,
    },
    comment: 'Location-based credit multiplier (0.5 to 3.0)',
  },
  
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
  tableName: 'properties',
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