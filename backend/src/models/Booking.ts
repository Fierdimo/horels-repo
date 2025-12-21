import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import Property from './Property';

class Booking extends Model {
  public id!: number;
  public property_id!: number;
  public room_id?: number; // Habitación específica reservada
  public guest_name!: string;
  public guest_email!: string;
  public guest_phone?: string;
  public check_in!: Date;
  public check_out!: Date;
  public room_type!: string;
  public status!: 'pending' | 'confirmed' | 'checked_in' | 'checked_out' | 'cancelled';
  public guest_token!: string; // For hotel guest access
  public total_amount?: number;
  public currency?: string;
  public payment_intent_id?: string; // Stripe Payment Intent ID
  public payment_status?: string; // 'pending' | 'processing' | 'paid' | 'failed' | 'refunded'
  // Association: when included, Sequelize will add the related Property instance
  public readonly Property?: Property | null;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

Booking.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  property_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  room_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'rooms',
      key: 'id',
    },
  },
  guest_name: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  guest_email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  guest_phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  check_in: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  check_out: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  room_type: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'confirmed', 'checked_in', 'checked_out', 'cancelled'),
    defaultValue: 'pending',
  },
  guest_token: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  total_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  currency: {
    type: DataTypes.STRING(3),
    defaultValue: 'EUR',
  },
  pms_booking_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  pms_provider: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payment_intent_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  payment_reference: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  idempotency_key: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: false,
  },
  night_credit_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  swap_request_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  raw: {
    type: DataTypes.JSON,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'Booking',
  tableName: 'bookings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default Booking;