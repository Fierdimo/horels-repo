import { Model, DataTypes, Op } from 'sequelize';
import sequelize from '../config/database';

interface CreditTransactionAttributes {
  id: number;
  user_id: number;
  transaction_type: 'DEPOSIT' | 'SPEND' | 'REFUND' | 'EXPIRATION' | 'ADJUSTMENT' | 'TOPUP';
  amount: number;
  balance_after: number;
  status: 'ACTIVE' | 'SPENT' | 'EXPIRED' | 'REFUNDED';
  booking_id?: number;
  week_id?: number;
  deposited_at?: Date;
  expires_at?: Date;
  description?: string;
  metadata?: any;
  created_by?: number;
  created_at: Date;
  updated_at: Date;
}

interface CreditTransactionCreationAttributes extends Omit<CreditTransactionAttributes, 'id' | 'created_at' | 'updated_at'> {}

class CreditTransaction extends Model<CreditTransactionAttributes, CreditTransactionCreationAttributes> implements CreditTransactionAttributes {
  public id!: number;
  public user_id!: number;
  public transaction_type!: 'DEPOSIT' | 'SPEND' | 'REFUND' | 'EXPIRATION' | 'ADJUSTMENT' | 'TOPUP';
  public amount!: number;
  public balance_after!: number;
  public status!: 'ACTIVE' | 'SPENT' | 'EXPIRED' | 'REFUNDED';
  public booking_id?: number;
  public week_id?: number;
  public deposited_at?: Date;
  public expires_at?: Date;
  public description?: string;
  public metadata?: any;
  public created_by?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get user transaction history
   */
  static async getUserHistory(userId: number, limit: number = 50): Promise<CreditTransaction[]> {
    return await this.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Get active credits for user (not expired, not spent)
   */
  static async getActiveCredits(userId: number): Promise<CreditTransaction[]> {
    const now = new Date();
    return await this.findAll({
      where: {
        user_id: userId,
        status: 'ACTIVE',
        transaction_type: 'DEPOSIT',
        expires_at: { [Op.gt]: now }
      },
      order: [['expires_at', 'ASC']] // Oldest first (FIFO)
    });
  }

  /**
   * Get credits expiring soon (within days)
   */
  static async getExpiringSoon(userId: number, days: number = 30): Promise<CreditTransaction[]> {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return await this.findAll({
      where: {
        user_id: userId,
        status: 'ACTIVE',
        transaction_type: 'DEPOSIT',
        expires_at: {
          [Op.between]: [now, futureDate]
        }
      },
      order: [['expires_at', 'ASC']]
    });
  }

  /**
   * Get expired credits that need processing
   */
  static async getExpiredCredits(): Promise<CreditTransaction[]> {
    const now = new Date();
    return await this.findAll({
      where: {
        status: 'ACTIVE',
        transaction_type: 'DEPOSIT',
        expires_at: { [Op.lt]: now }
      }
    });
  }

  /**
   * Create deposit transaction
   */
  static async createDeposit(
    userId: number,
    weekId: number,
    credits: number,
    balanceAfter: number,
    expiresAt: Date,
    metadata?: any,
    transaction?: any
  ): Promise<CreditTransaction> {
    return await this.create({
      user_id: userId,
      week_id: weekId,
      transaction_type: 'DEPOSIT',
      amount: credits,
      balance_after: balanceAfter,
      status: 'ACTIVE',
      deposited_at: new Date(),
      expires_at: expiresAt,
      description: `Deposited week #${weekId} for ${credits} credits`,
      metadata
    }, { transaction });
  }

  /**
   * Create spend transaction
   */
  static async createSpend(
    userId: number,
    bookingId: number,
    credits: number,
    balanceAfter: number,
    metadata?: any,
    transaction?: any
  ): Promise<CreditTransaction> {
    return await this.create({
      user_id: userId,
      booking_id: bookingId,
      transaction_type: 'SPEND',
      amount: -Math.abs(credits),
      balance_after: balanceAfter,
      status: 'SPENT',
      description: `Spent ${credits} credits on booking #${bookingId}`,
      metadata
    }, { transaction });
  }
}

CreditTransaction.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    transaction_type: {
      type: DataTypes.ENUM('DEPOSIT', 'SPEND', 'REFUND', 'EXPIRATION', 'ADJUSTMENT', 'TOPUP'),
      allowNull: false,
    },
    amount: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    balance_after: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM('ACTIVE', 'SPENT', 'EXPIRED', 'REFUNDED'),
      allowNull: false,
      defaultValue: 'ACTIVE',
    },
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'bookings',
        key: 'id',
      },
    },
    week_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'weeks',
        key: 'id',
      },
    },
    deposited_at: {
      type: DataTypes.DATE(3),
      allowNull: true,
    },
    expires_at: {
      type: DataTypes.DATE(3),
      allowNull: true,
    },
    description: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
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
    tableName: 'credit_transactions',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['user_id', 'created_at'] },
      { fields: ['user_id', 'status', 'expires_at'] },
      { fields: ['expires_at', 'status'] },
      { fields: ['transaction_type'] },
      { fields: ['booking_id'] },
      { fields: ['week_id'] },
      { fields: ['status'] },
    ],
  }
);

export default CreditTransaction;
