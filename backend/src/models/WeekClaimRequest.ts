import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

interface WeekClaimRequestAttributes {
  id: number;
  week_id: number;
  user_id: number;
  verification_method: 'DEED_UPLOAD' | 'OWNER_VERIFICATION' | 'ADMIN_MANUAL';
  verification_status: 'PENDING' | 'APPROVED' | 'REJECTED';
  deed_document_url?: string;
  owner_confirmation_code?: string;
  rejection_reason?: string;
  verified_by?: number;
  verified_at?: Date;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface WeekClaimRequestCreationAttributes extends Omit<WeekClaimRequestAttributes, 'id' | 'created_at' | 'updated_at'> {}

class WeekClaimRequest extends Model<WeekClaimRequestAttributes, WeekClaimRequestCreationAttributes> implements WeekClaimRequestAttributes {
  public id!: number;
  public week_id!: number;
  public user_id!: number;
  public verification_method!: 'DEED_UPLOAD' | 'OWNER_VERIFICATION' | 'ADMIN_MANUAL';
  public verification_status!: 'PENDING' | 'APPROVED' | 'REJECTED';
  public deed_document_url?: string;
  public owner_confirmation_code?: string;
  public rejection_reason?: string;
  public verified_by?: number;
  public verified_at?: Date;
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get pending requests for admin review
   */
  static async getPendingRequests(limit: number = 50): Promise<WeekClaimRequest[]> {
    return await this.findAll({
      where: { verification_status: 'PENDING' },
      order: [['created_at', 'ASC']],
      limit
    });
  }

  /**
   * Get user's claim history
   */
  static async getUserRequests(userId: number): Promise<WeekClaimRequest[]> {
    return await this.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']]
    });
  }

  /**
   * Check if week has pending claim
   */
  static async hasPendingClaim(weekId: number): Promise<boolean> {
    const count = await this.count({
      where: {
        week_id: weekId,
        verification_status: 'PENDING'
      }
    });
    return count > 0;
  }

  /**
   * Approve claim request
   */
  static async approveClaim(
    requestId: number,
    verifiedBy: number,
    notes?: string,
    transaction?: any
  ): Promise<WeekClaimRequest> {
    const request = await this.findByPk(requestId, { transaction });
    if (!request) {
      throw new Error('Claim request not found');
    }

    if (request.verification_status !== 'PENDING') {
      throw new Error('Can only approve pending requests');
    }

    await request.update(
      {
        verification_status: 'APPROVED',
        verified_by: verifiedBy,
        verified_at: new Date(),
        notes
      },
      { transaction }
    );

    return request;
  }

  /**
   * Reject claim request
   */
  static async rejectClaim(
    requestId: number,
    verifiedBy: number,
    rejectionReason: string,
    notes?: string,
    transaction?: any
  ): Promise<WeekClaimRequest> {
    const request = await this.findByPk(requestId, { transaction });
    if (!request) {
      throw new Error('Claim request not found');
    }

    if (request.verification_status !== 'PENDING') {
      throw new Error('Can only reject pending requests');
    }

    await request.update(
      {
        verification_status: 'REJECTED',
        rejection_reason: rejectionReason,
        verified_by: verifiedBy,
        verified_at: new Date(),
        notes
      },
      { transaction }
    );

    return request;
  }

  /**
   * Create new claim request with deed upload
   */
  static async createWithDeed(
    weekId: number,
    userId: number,
    deedDocumentUrl: string,
    notes?: string
  ): Promise<WeekClaimRequest> {
    return await this.create({
      week_id: weekId,
      user_id: userId,
      verification_method: 'DEED_UPLOAD',
      verification_status: 'PENDING',
      deed_document_url: deedDocumentUrl,
      notes
    });
  }

  /**
   * Create new claim request with owner confirmation
   */
  static async createWithOwnerConfirmation(
    weekId: number,
    userId: number,
    confirmationCode: string,
    notes?: string
  ): Promise<WeekClaimRequest> {
    return await this.create({
      week_id: weekId,
      user_id: userId,
      verification_method: 'OWNER_VERIFICATION',
      verification_status: 'PENDING',
      owner_confirmation_code: confirmationCode,
      notes
    });
  }
}

WeekClaimRequest.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    week_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'weeks',
        key: 'id',
      },
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    verification_method: {
      type: DataTypes.ENUM('DEED_UPLOAD', 'OWNER_VERIFICATION', 'ADMIN_MANUAL'),
      allowNull: false,
    },
    verification_status: {
      type: DataTypes.ENUM('PENDING', 'APPROVED', 'REJECTED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    deed_document_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    owner_confirmation_code: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    verified_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    verified_at: {
      type: DataTypes.DATE(3),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'week_claim_requests',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['week_id'] },
      { fields: ['user_id'] },
      { fields: ['verification_status'] },
      { fields: ['verified_by'] },
    ],
  }
);

export default WeekClaimRequest;
