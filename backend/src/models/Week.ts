import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class Week extends Model {
  public id!: number;
  public owner_id!: number;
  public property_id!: number;
  public start_date!: Date;
  public end_date!: Date;
  public color!: 'red' | 'blue' | 'white';
  public status!: 'available' | 'confirmed' | 'converted' | 'used';
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
    allowNull: false,
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  color: {
    type: DataTypes.ENUM('red', 'blue', 'white'),
    allowNull: false,
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