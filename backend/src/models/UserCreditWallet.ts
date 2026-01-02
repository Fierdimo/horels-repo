import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

interface UserCreditWalletAttributes {
  id: number;
  user_id: number;
  total_balance: number;
  total_earned: number;
  total_spent: number;
  total_expired: number;
  pending_expiration: number;
  last_transaction_at?: Date;
  created_at: Date;
  updated_at: Date;
}

interface UserCreditWalletCreationAttributes extends Omit<UserCreditWalletAttributes, 'id' | 'created_at' | 'updated_at'> {}

class UserCreditWallet extends Model<UserCreditWalletAttributes, UserCreditWalletCreationAttributes> implements UserCreditWalletAttributes {
  public id!: number;
  public user_id!: number;
  public total_balance!: number;
  public total_earned!: number;
  public total_spent!: number;
  public total_expired!: number;
  public pending_expiration!: number;
  public last_transaction_at?: Date;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get wallet by user ID (creates if doesn't exist)
   */
  static async getOrCreateWallet(userId: number): Promise<UserCreditWallet> {
    const [wallet] = await this.findOrCreate({
      where: { user_id: userId },
      defaults: {
        user_id: userId,
        total_balance: 0,
        total_earned: 0,
        total_spent: 0,
        total_expired: 0,
        pending_expiration: 0
      }
    });
    return wallet;
  }

  /**
   * Get wallet with lock for transaction
   */
  static async getWalletWithLock(userId: number, transaction: any): Promise<UserCreditWallet> {
    const wallet = await this.findOne({
      where: { user_id: userId },
      lock: transaction.LOCK.UPDATE,
      transaction
    });

    if (!wallet) {
      throw new Error('Wallet not found');
    }

    return wallet;
  }

  /**
   * Update balance (should only be called within transaction)
   */
  async updateBalance(amount: number, type: 'EARN' | 'SPEND' | 'EXPIRE'): Promise<void> {
    this.total_balance += amount;
    this.last_transaction_at = new Date();

    switch (type) {
      case 'EARN':
        this.total_earned += Math.abs(amount);
        break;
      case 'SPEND':
        this.total_spent += Math.abs(amount);
        break;
      case 'EXPIRE':
        this.total_expired += Math.abs(amount);
        break;
    }

    await this.save();
  }
}

UserCreditWallet.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    total_balance: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_earned: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_spent: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    total_expired: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    pending_expiration: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    last_transaction_at: {
      type: DataTypes.DATE(3),
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
    tableName: 'user_credit_wallets',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['total_balance'] },
      { fields: ['pending_expiration'] },
      { fields: ['last_transaction_at'] },
    ],
  }
);

export default UserCreditWallet;
