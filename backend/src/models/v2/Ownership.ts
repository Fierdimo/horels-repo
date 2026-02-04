import { Model, DataTypes, Sequelize, Association } from 'sequelize';
import TimeshareUnit from './TimeshareUnit';
import WeekAllocation from './WeekAllocation';

/**
 * Ownership Model (V2)
 * 
 * Timeshare ownership contracts. Links owners (users) to units.
 * Supports fixed week, floating, and points-based systems.
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Section "ownerships"
 */
class Ownership extends Model {
  public id!: number;
  public owner_id!: number; // FK to users (INT not UNSIGNED)
  public unit_id!: number;
  
  // Ownership Type
  public type!: 'FIXED_WEEK' | 'FLOATING' | 'POINTS';
  
  // Fixed Week Configuration
  public fixed_week_number!: number | null;
  
  // Floating/Points Configuration
  public annual_points!: number | null;
  
  // Contract Details
  public purchase_date!: Date | null;
  public contract_reference!: string | null;
  public contract_start_year!: number;
  public contract_end_year!: number | null;
  
  // Financial
  public annual_fee!: number;
  public annual_fee_due_date!: Date | null;
  public last_payment_date!: Date | null;
  public currency!: string;
  
  // Status
  public status!: 'ACTIVE' | 'SUSPENDED' | 'TERMINATED' | 'PENDING_PAYMENT' | 'CONVERTED_TO_CREDITS' | 'CANCELLED';
  public suspension_reason!: string | null;
  
  // Additional fields
  public notes!: string | null;
  public metadata!: string | null; // JSON stored as text
  
  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  
  // Associations
  public readonly unit?: TimeshareUnit;
  public readonly weekAllocations?: WeekAllocation[];
  public readonly weeks?: WeekAllocation[]; // Alias for weekAllocations
  public readonly owner?: any; // User model (V1 compatibility)
  
  public static associations: {
    unit: Association<Ownership, TimeshareUnit>;
    weekAllocations: Association<Ownership, WeekAllocation>;
    owner: Association<Ownership, any>;
  };
}

export function initOwnership(sequelize: Sequelize): typeof Ownership {
  Ownership.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      owner_id: {
        type: DataTypes.INTEGER, // INT(11) to match users.id
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      unit_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'timeshare_units',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      
      // Ownership Type
      type: {
        type: DataTypes.ENUM('FIXED_WEEK', 'FLOATING', 'POINTS'),
        allowNull: false,
      },
      
      // Fixed Week Configuration
      fixed_week_number: {
        type: DataTypes.TINYINT.UNSIGNED,
        allowNull: true,
        comment: '1-52, NULL if floating/points',
      },
      
      // Floating/Points Configuration
      annual_points: {
        type: DataTypes.SMALLINT.UNSIGNED,
        allowNull: true,
        comment: 'Annual points allocation, NULL if fixed week',
      },
      
      // Contract Details
      purchase_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
      },
      contract_reference: {
        type: DataTypes.STRING(255),
        allowNull: true,
        comment: 'External contract ID/reference',
      },
      contract_start_year: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        comment: 'Year ownership begins',
      },
      contract_end_year: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'Year ownership ends, NULL = perpetual',
      },
      
      // Financial
      annual_fee: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Annual maintenance fee',
      },
      annual_fee_due_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Date when annual fee is due',
      },
      last_payment_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Last payment date',
      },
      currency: {
        type: DataTypes.STRING(3),
        defaultValue: 'EUR',
        allowNull: false,
      },
      
      // Status
      status: {
        type: DataTypes.ENUM('ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_PAYMENT', 'CONVERTED_TO_CREDITS', 'CANCELLED'),
        defaultValue: 'ACTIVE',
        allowNull: false,
      },
      suspension_reason: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      
      // Additional fields
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      metadata: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        comment: 'JSON object for additional data',
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
      tableName: 'ownerships',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'idx_owner',
          fields: ['owner_id'],
        },
        {
          name: 'idx_unit',
          fields: ['unit_id'],
        },
        {
          name: 'idx_type',
          fields: ['type', 'status'],
        },
        {
          name: 'idx_contract',
          fields: ['contract_start_year', 'contract_end_year'],
        },
      ],
    }
  );

  return Ownership;
}

export default Ownership;
