import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Week extends Model {
  public id!: number;
  public owner_id!: number;
  public property_id!: number;
  public start_date!: Date | null; // Nullable for floating periods
  public end_date!: Date | null; // Nullable for floating periods
  public nights!: number | null; // Duration for floating periods
  public valid_until!: Date | null; // Expiration date for floating periods
  public accommodation_type!: string; // e.g., 'sencilla', 'duplex', 'suite'
  public status!: 'available' | 'confirmed' | 'converted' | 'used' | 'pending_swap';
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Week.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
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
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: true, // Nullable for floating periods
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true, // Nullable for floating periods
  },
  nights: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Number of nights for floating periods (when start_date is null)'
  },
  valid_until: {
    type: DataTypes.DATE,
    allowNull: true,
    comment: 'Expiration date for floating periods'
  },
  accommodation_type: {
    type: DataTypes.STRING,
    allowNull: false,
    comment: 'Type of accommodation (sencilla, duplex, suite, etc.) - inherited from room.type'
  },
  status: {
    type: DataTypes.ENUM('available', 'confirmed', 'converted', 'used'),
    defaultValue: 'available',
  },
}, {
  sequelize,
  modelName: 'Week',
  tableName: 'weeks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default Week;