import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

class SwapRequest extends Model {
  public id!: number;
  public requester_id!: number;
  public requester_week_id!: number;
  public responder_week_id?: number;
  public responder_id?: number; // NEW: ID of user who accepted/responded
  public requester_source_type!: 'week' | 'booking'; // NEW: type of source
  public requester_source_id!: number; // NEW: actual ID of week or booking
  public responder_source_type?: 'week' | 'booking'; // NEW: type of responder source
  public responder_source_id?: number; // NEW: actual ID of responder's week or booking
  public desired_start_date?: Date;
  public desired_end_date?: Date;
  public status!: 'pending' | 'matched' | 'awaiting_payment' | 'completed' | 'cancelled';
  public swap_fee!: number;
  public notes?: string;
  public accommodation_type?: string; // Denormalized from weeks for efficient matching
  
  // Approval workflow fields
  public reviewed_by_staff_id?: number;
  public staff_approval_status!: 'pending_review' | 'approved' | 'rejected';
  public staff_review_date?: Date;
  public staff_notes?: string;
  public responder_acceptance!: 'pending' | 'accepted' | 'rejected';
  public responder_acceptance_date?: Date;
  
  // Payment fields
  public commission_amount?: number;
  public payment_intent_id?: string;
  public payment_status!: 'pending' | 'paid' | 'refunded' | 'failed';
  public paid_at?: Date;
  public property_id?: number;
  
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

SwapRequest.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  requester_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  requester_week_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'DEPRECATED: Use requester_source_type and requester_source_id instead'
  },
  responder_week_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'DEPRECATED: Use responder_source_type and responder_source_id instead'
  },
  responder_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    },
    comment: 'ID of user who accepted/responded to the swap'
  },
  requester_source_type: {
    type: DataTypes.ENUM('week', 'booking'),
    allowNull: false,
    defaultValue: 'week',
    comment: 'Type of requester source: week or booking'
  },
  requester_source_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    comment: 'ID of the week or booking being offered'
  },
  responder_source_type: {
    type: DataTypes.ENUM('week', 'booking'),
    allowNull: true,
    comment: 'Type of responder source: week or booking'
  },
  responder_source_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID of the week or booking being offered by responder'
  },
  desired_start_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  desired_end_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'matched', 'awaiting_payment', 'completed', 'cancelled'),
    defaultValue: 'pending',
  },
  swap_fee: {
    type: DataTypes.DECIMAL(10, 2),
    defaultValue: 10.00,
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  accommodation_type: {
    type: DataTypes.STRING(100),
    allowNull: true,
    comment: 'Denormalized from weeks for efficient swap matching'
  },
  reviewed_by_staff_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  staff_approval_status: {
    type: DataTypes.ENUM('pending_review', 'approved', 'rejected'),
    defaultValue: 'pending_review',
  },
  staff_review_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  staff_notes: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  responder_acceptance: {
    type: DataTypes.ENUM('pending', 'accepted', 'rejected'),
    defaultValue: 'pending',
  },
  responder_acceptance_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  commission_amount: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
  },
  payment_intent_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  payment_status: {
    type: DataTypes.ENUM('pending', 'paid', 'refunded', 'failed'),
    defaultValue: 'pending',
  },
  paid_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  property_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  sequelize,
  modelName: 'SwapRequest',
  tableName: 'swap_requests',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default SwapRequest;