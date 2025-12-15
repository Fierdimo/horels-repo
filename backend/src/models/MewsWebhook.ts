import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class MewsWebhook extends Model {
  public id!: number;
  public provider!: string;
  public enterprise_id?: string | null;
  public integration_id?: string | null;
  public webhook_type!: 'general' | 'integration';
  public action?: string | null;
  public events?: object | null;
  public raw!: object;
  public processed!: boolean;
  public processing_attempts!: number;
}

MewsWebhook.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  provider: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'mews',
  },
  enterprise_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  integration_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  webhook_type: {
    type: DataTypes.ENUM('general', 'integration'),
    allowNull: false,
  },
  action: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  events: {
    type: DataTypes.JSON,
    allowNull: true,
  },
  raw: {
    type: DataTypes.JSON,
    allowNull: false,
  },
  processed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  processing_attempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  sequelize,
  modelName: 'MewsWebhook',
  tableName: 'mews_webhooks',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default MewsWebhook;
