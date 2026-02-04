import { Model, DataTypes, Sequelize, Association } from 'sequelize';
import CreditTransaction from './CreditTransaction';

/**
 * CreditAccount Model (V2)
 * 
 * User credit balances. Single source of truth for credit balance.
 * 1:1 relationship with users table.
 * 
 * ⚠️ Balance should be updated via credit_transactions (ledger pattern)
 * Never update balance directly - use CreditService to ensure transaction immutability
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Section "credit_accounts"
 */
class CreditAccount extends Model {
  public id!: number;
  public user_id!: number; // FK to users (INT not UNSIGNED)
  
  // Balance
  public balance!: number;
  
  // Analytics/Tracking
  public total_earned!: number;
  public total_spent!: number;
  public total_expired!: number;
  
  // Limits & Restrictions
  public credit_limit!: number | null;
  public expiration_policy!: 'NEVER' | '1_YEAR' | '2_YEARS';
  
  // Metadata
  public last_transaction_at!: Date | null;
  public currency!: string;
  public notes!: string | null;
  
  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
  
  // Associations
  public readonly transactions?: CreditTransaction[];
  
  public static associations: {
    transactions: Association<CreditAccount, CreditTransaction>;
  };
  
  /**
   * Check if account has sufficient balance
   */
  public hasSufficientBalance(amount: number): boolean {
    if (this.credit_limit !== null) {
      // Account has credit limit (can go negative)
      return this.balance - amount >= -this.credit_limit;
    }
    return this.balance >= amount;
  }
  
  /**
   * Get available balance (considering credit limit)
   */
  public getAvailableBalance(): number {
    if (this.credit_limit !== null) {
      return this.balance + this.credit_limit;
    }
    return this.balance;
  }
}

export function initCreditAccount(sequelize: Sequelize): typeof CreditAccount {
  CreditAccount.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER, // INT(11) to match users.id
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
        comment: '1:1 relationship with users',
      },
      
      // Balance
      balance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Current credit balance',
      },
      
      // Analytics/Tracking
      total_earned: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total credits earned (for analytics)',
      },
      total_spent: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total credits spent (for analytics)',
      },
      total_expired: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
        comment: 'Total credits expired (for analytics)',
      },
      
      // Limits & Restrictions
      credit_limit: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Max negative balance (for staff/VIP), NULL = no limit',
      },
      expiration_policy: {
        type: DataTypes.ENUM('NEVER', '1_YEAR', '2_YEARS'),
        defaultValue: '2_YEARS',
        allowNull: false,
      },
      
      // Metadata (for reporting/analytics)
      last_transaction_at: {
        type: DataTypes.DATE,
        allowNull: true,
      },
      currency: {
        type: DataTypes.STRING(3),
        allowNull: false,
        defaultValue: 'EUR',
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      
      // Timestamps
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'credit_accounts',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          name: 'idx_user',
          fields: ['user_id'],
          unique: true,
        },
        {
          name: 'idx_balance',
          fields: ['balance'],
        },
      ],
    }
  );

  return CreditAccount;
}

export default CreditAccount;
