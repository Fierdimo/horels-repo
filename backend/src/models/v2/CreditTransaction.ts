import { Model, DataTypes, Sequelize, Association } from 'sequelize';
import CreditAccount from './CreditAccount';

/**
 * CreditTransaction Model (V2)
 * 
 * ⚠️ IMMUTABLE LEDGER - APPEND-ONLY
 * 
 * All credit movements are recorded here. This table is:
 * - APPEND-ONLY (no updates, no deletes)
 * - AUDIT TRAIL (balance_before + amount = balance_after)
 * - SOURCE OF TRUTH for credit history
 * 
 * Transaction Types:
 * - WEEK_RELEASE: Owner releases week → earns credits
 * - WEEK_BOOKING: Guest books week → spends credits
 * - CREDIT_PURCHASE: Guest buys credits with cash
 * - CREDIT_EXPIRATION: Credits expire per policy
 * - CONDOMINIUM_PAYMENT: Credits used for maintenance fees
 * - REFUND: Cancelled booking → credits refunded
 * - ADJUSTMENT: Manual admin correction
 * 
 * See: docs_v2/TIMESHARE_PLATFORM_V2_SPEC.md - Section "credit_transactions"
 */
class CreditTransaction extends Model {
  public id!: bigint; // BIGINT for billions of transactions
  public account_id!: number;
  
  // Transaction Details
  public type!: 'WEEK_RELEASE' | 'WEEK_BOOKING' | 'CREDIT_PURCHASE' | 'CREDIT_EXPIRATION' | 'CONDOMINIUM_PAYMENT' | 'REFUND' | 'ADJUSTMENT';
  public amount!: number; // Positive = credit, Negative = debit
  public balance_before!: number;
  public balance_after!: number;
  
  // References
  public reference_type!: string | null;
  public reference_id!: number | null;
  
  // Description
  public description!: string;
  public metadata!: object | null;
  
  // Audit Trail
  public created_by!: number | null; // FK to users (INT not UNSIGNED)
  public ip_address!: string | null;
  
  // Timestamp (no updated_at - immutable)
  public readonly created_at!: Date;
  
  // Associations
  public readonly account?: CreditAccount;
  
  public static associations: {
    account: Association<CreditTransaction, CreditAccount>;
  };
  
  /**
   * Validate transaction balance integrity
   */
  public validateBalance(): boolean {
    const calculatedBalance = parseFloat(this.balance_before.toString()) + parseFloat(this.amount.toString());
    const actualBalance = parseFloat(this.balance_after.toString());
    return Math.abs(calculatedBalance - actualBalance) < 0.01; // Allow for floating point precision
  }
  
  /**
   * Check if transaction is a credit (positive amount)
   */
  public isCredit(): boolean {
    return parseFloat(this.amount.toString()) > 0;
  }
  
  /**
   * Check if transaction is a debit (negative amount)
   */
  public isDebit(): boolean {
    return parseFloat(this.amount.toString()) < 0;
  }
}

export function initCreditTransaction(sequelize: Sequelize): typeof CreditTransaction {
  CreditTransaction.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
        comment: 'BIGINT for billions of transactions',
      },
      account_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'credit_accounts',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      
      // Transaction Details
      type: {
        type: DataTypes.ENUM(
          'WEEK_RELEASE',
          'WEEK_BOOKING',
          'CREDIT_PURCHASE',
          'CREDIT_EXPIRATION',
          'CONDOMINIUM_PAYMENT',
          'REFUND',
          'ADJUSTMENT'
        ),
        allowNull: false,
      },
      amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Positive = credit, Negative = debit',
      },
      balance_before: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Balance before transaction',
      },
      balance_after: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Balance after transaction (must equal balance_before + amount)',
      },
      
      // References
      reference_type: {
        type: DataTypes.STRING(50),
        allowNull: true,
        comment: 'e.g., "week_allocation", "booking", "payment"',
      },
      reference_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        comment: 'ID of referenced entity',
      },
      
      // Description
      description: {
        type: DataTypes.STRING(500),
        allowNull: false,
        comment: 'Human-readable description',
      },
      metadata: {
        type: DataTypes.JSON,
        allowNull: true,
        comment: 'Additional details, calculations, etc.',
      },
      
      // Audit Trail
      created_by: {
        type: DataTypes.INTEGER, // INT(11) to match users.id
        allowNull: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
        comment: 'Admin user if manual transaction',
      },
      ip_address: {
        type: DataTypes.STRING(45),
        allowNull: true,
        comment: 'IPv4 or IPv6',
      },
      
      // Timestamp (NO updated_at - immutable)
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
      },
    },
    {
      sequelize,
      tableName: 'credit_transactions',
      timestamps: false, // Only created_at, no updated_at
      underscored: true,
      createdAt: 'created_at',
      updatedAt: false,
      indexes: [
        {
          name: 'idx_account_created',
          fields: ['account_id', 'created_at'],
        },
        {
          name: 'idx_type',
          fields: ['type', 'created_at'],
        },
        {
          name: 'idx_reference',
          fields: ['reference_type', 'reference_id'],
        },
      ],
      validate: {
        // Ensure balance_after = balance_before + amount
        balanceIntegrity(this: CreditTransaction) {
          const calculated = parseFloat(String(this.balance_before)) + parseFloat(String(this.amount));
          const actual = parseFloat(String(this.balance_after));
          if (Math.abs(calculated - actual) >= 0.01) {
            throw new Error(`Balance integrity violation: ${this.balance_before} + ${this.amount} ≠ ${this.balance_after}`);
          }
        },
      },
    }
  );

  return CreditTransaction;
}

export default CreditTransaction;
