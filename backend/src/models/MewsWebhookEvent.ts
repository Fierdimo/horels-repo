import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class MewsWebhookEvent extends Model {
  public id!: number;
  public webhook_id!: number;
  public discriminator!: string;
  public entity_id!: string;
  public idempotency_key!: string;
  public processed_at?: Date | null;
}

MewsWebhookEvent.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  webhook_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  discriminator: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  entity_id: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  idempotency_key: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  processed_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'MewsWebhookEvent',
  tableName: 'mews_webhook_events',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default MewsWebhookEvent;
