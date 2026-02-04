import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface TimeshareAllocationAttributes {
  id: number;
  property_id: number;
  
  // PMS identification
  pms_resource_id: string;
  pms_provider: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other';
  pms_metadata?: any; // Provider-specific data (JSON)
  
  // Room information
  room_number?: string;
  room_type: string;
  floor_number?: string;
  
  // Validity period
  valid_from: Date;
  valid_until: Date;
  
  // Financial information
  allocation_type: 'ANNUAL_CONTRACT' | 'PERPETUAL' | 'SEASONAL';
  prepaid_amount?: number;
  condominium_fee?: number;
  currency: string;
  
  // Current status
  status: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'DELETED';
  current_week_owner_id?: number;
  is_released: boolean;
  
  // Metadata
  notes?: string;
  contract_reference?: string;
  
  // Timestamps
  created_at: Date;
  updated_at: Date;
  last_sync_at?: Date;
}

interface TimeshareAllocationCreationAttributes
  extends Optional<
    TimeshareAllocationAttributes,
    'id' | 'pms_metadata' | 'room_number' | 'floor_number' | 
    'prepaid_amount' | 'condominium_fee' | 'current_week_owner_id' | 
    'notes' | 'contract_reference' | 'created_at' | 'updated_at' | 'last_sync_at'
  > {}

class TimeshareAllocation
  extends Model<TimeshareAllocationAttributes, TimeshareAllocationCreationAttributes>
  implements TimeshareAllocationAttributes
{
  public id!: number;
  public property_id!: number;
  
  public pms_resource_id!: string;
  public pms_provider!: 'mews' | 'cloudbeds' | 'opera' | 'resnexus' | 'other';
  public pms_metadata?: any;
  
  public room_number?: string;
  public room_type!: string;
  public floor_number?: string;
  
  public valid_from!: Date;
  public valid_until!: Date;
  
  public allocation_type!: 'ANNUAL_CONTRACT' | 'PERPETUAL' | 'SEASONAL';
  public prepaid_amount?: number;
  public condominium_fee?: number;
  public currency!: string;
  
  public status!: 'ACTIVE' | 'EXPIRED' | 'SUSPENDED' | 'DELETED';
  public current_week_owner_id?: number;
  public is_released!: boolean;
  
  public notes?: string;
  public contract_reference?: string;
  
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  public last_sync_at?: Date;

  // Helper methods
  public isValid(): boolean {
    const now = new Date();
    return (
      this.status === 'ACTIVE' &&
      this.valid_from <= now &&
      this.valid_until >= now
    );
  }

  public isExpiringSoon(daysThreshold: number = 30): boolean {
    const now = new Date();
    const threshold = new Date();
    threshold.setDate(threshold.getDate() + daysThreshold);
    
    return (
      this.status === 'ACTIVE' &&
      this.valid_until >= now &&
      this.valid_until <= threshold
    );
  }

  public isAvailable(): boolean {
    return (
      this.isValid() &&
      this.is_released &&
      !this.current_week_owner_id
    );
  }

  public getMarginPercent(): number {
    // Prepaid inventory = 100% margin
    return 100;
  }

  public getCostToPlattform(): number {
    // Prepaid inventory = zero marginal cost
    return 0;
  }
}

TimeshareAllocation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'properties',
        key: 'id',
      },
    },
    pms_resource_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    pms_provider: {
      type: DataTypes.ENUM('mews', 'cloudbeds', 'opera', 'resnexus', 'other'),
      allowNull: false,
      defaultValue: 'mews',
    },
    pms_metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    room_number: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
    room_type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    floor_number: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    valid_from: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    valid_until: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    allocation_type: {
      type: DataTypes.ENUM('ANNUAL_CONTRACT', 'PERPETUAL', 'SEASONAL'),
      allowNull: false,
      defaultValue: 'ANNUAL_CONTRACT',
    },
    prepaid_amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    condominium_fee: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    currency: {
      type: DataTypes.STRING(3),
      allowNull: false,
      defaultValue: 'EUR',
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'EXPIRED', 'SUSPENDED', 'DELETED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    current_week_owner_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    is_released: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    contract_reference: {
      type: DataTypes.STRING(255),
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
    last_sync_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'timeshare_allocations',
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: 'idx_allocations_property',
        fields: ['property_id'],
      },
      {
        name: 'idx_allocations_pms_resource',
        fields: ['pms_resource_id', 'pms_provider'],
      },
      {
        name: 'idx_allocations_dates',
        fields: ['valid_from', 'valid_until'],
      },
      {
        name: 'idx_allocations_status',
        fields: ['status', 'is_released'],
      },
      {
        name: 'idx_allocations_owner',
        fields: ['current_week_owner_id'],
      },
      {
        unique: true,
        name: 'unique_active_allocation',
        fields: ['property_id', 'pms_resource_id', 'status'],
        where: {
          status: 'ACTIVE',
        },
      },
    ],
  }
);

export default TimeshareAllocation;
