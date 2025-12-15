import { DataTypes } from 'sequelize';
import sequelize from '../config/database';

// Fee model: stores small platform fees (swap/conversion) for accounting
const Fee = sequelize.define('Fee', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  paymentId: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'payment_id',
  },
  amount: {
    // stored as integer (e.g. euros) to match existing service semantics
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },
  currency: {
    type: DataTypes.STRING(10),
    allowNull: false,
    defaultValue: 'eur',
  },
  userId: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
    field: 'user_id',
  },
  type: {
    type: DataTypes.ENUM('swap_fee', 'conversion_fee'),
    allowNull: false,
  },
  status: {
    type: DataTypes.ENUM('pending', 'completed', 'failed'),
    allowNull: false,
    defaultValue: 'completed',
  },
  stripeChargeId: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'stripe_charge_id',
  },
  bookingId: {
    type: DataTypes.INTEGER,
    allowNull: true,
    field: 'booking_id',
  },
}, {
  tableName: 'fees',
  underscored: true,
  timestamps: true,
});

export default Fee;
