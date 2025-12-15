import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class NightCreditRequest extends Model {
  public id!: number;
  public owner_id!: number;
  public credit_id!: number;
  public property_id!: number;
  public check_in!: Date;
  public check_out!: Date;
  public nights_requested!: number;
  public room_type?: string;
  public status!: 'pending' | 'approved' | 'rejected' | 'expired' | 'completed';
  public reviewed_by_staff_id?: number;
  public review_date?: Date;
  public staff_notes?: string;
  public additional_nights!: number;
  public additional_price!: number;
  public additional_commission!: number;
  public payment_intent_id?: string;
  public payment_status!: 'not_required' | 'pending' | 'paid' | 'failed' | 'refunded';
  public booking_id?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

NightCreditRequest.init({
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
  credit_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'night_credits',
      key: 'id'
    }
  },
  property_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'properties',
      key: 'id'
    }
  },
  check_in: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  check_out: {
    type: DataTypes.DATE,
    allowNull: false,
  },
  nights_requested: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  room_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired', 'completed'),
    defaultValue: 'pending',
  },
  reviewed_by_staff_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  review_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  staff_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  additional_nights: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  additional_price: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  additional_commission: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 0.00,
  },
  payment_intent_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.ENUM('not_required', 'pending', 'paid', 'failed', 'refunded'),
    defaultValue: 'not_required',
  },
  booking_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'bookings',
      key: 'id'
    }
  },
}, {
  sequelize,
  modelName: 'NightCreditRequest',
  tableName: 'night_credit_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default NightCreditRequest;
