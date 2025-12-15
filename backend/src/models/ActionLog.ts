import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface ActionLogAttributes {
  id: number;
  user_id?: number;
  action: string;
  details?: any;
  ip_address?: string;
  user_agent?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

class ActionLog extends Model<ActionLogAttributes> implements ActionLogAttributes {
  public id!: number;
  public user_id?: number;
  public action!: string;
  public details?: any;
  public ip_address?: string;
  public user_agent?: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

ActionLog.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  action: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  details: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  ip_address: {
    type: DataTypes.STRING(45),
    allowNull: true,
  },
  user_agent: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
}, {
  sequelize,
  tableName: 'action_logs',
  timestamps: true,
});

export default ActionLog;