import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class NightCredit extends Model {
  public id!: number;
  public owner_id!: number;
  public original_week_id!: number;
  public total_nights!: number;
  public remaining_nights!: number;
  public expiry_date!: Date;
  public status!: 'active' | 'expired' | 'used';
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

NightCredit.init({
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
  original_week_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'weeks',
      key: 'id'
    }
  },
  total_nights: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  remaining_nights: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  expiry_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('active', 'expired', 'used'),
    defaultValue: 'active',
  },
}, {
  sequelize,
  modelName: 'NightCredit',
  tableName: 'night_credits',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default NightCredit;