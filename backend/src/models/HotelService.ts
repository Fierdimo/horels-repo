import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class HotelService extends Model {
  public id!: number;
  public booking_id!: number;
  public service_type!: string;
  public status!: 'requested' | 'confirmed' | 'completed' | 'cancelled';
  public quantity!: number;
  public notes?: string;
  public price?: number;
  public requested_at!: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

HotelService.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'bookings',
      key: 'id'
    }
  },
  service_type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('requested', 'confirmed', 'completed', 'cancelled'),
    defaultValue: 'requested',
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  stripe_payment_intent: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  requested_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  sequelize,
  modelName: 'HotelService',
  tableName: 'hotel_services',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default HotelService;