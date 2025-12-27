import { Model, DataTypes, Op } from 'sequelize';
import sequelize from '../config/database';

interface InterPropertySettlementAttributes {
  id: number;
  booking_id: number;
  origin_property_id: number;
  destination_property_id: number;
  settlement_period: string;
  credits_transferred: number;
  euro_value: number;
  settlement_status: 'PENDING' | 'COMPLETED' | 'DISPUTED';
  settlement_date?: Date;
  notes?: string;
  metadata?: any;
  created_at: Date;
  updated_at: Date;
}

interface InterPropertySettlementCreationAttributes extends Omit<InterPropertySettlementAttributes, 'id' | 'created_at' | 'updated_at'> {}

class InterPropertySettlement extends Model<InterPropertySettlementAttributes, InterPropertySettlementCreationAttributes> implements InterPropertySettlementAttributes {
  public id!: number;
  public booking_id!: number;
  public origin_property_id!: number;
  public destination_property_id!: number;
  public settlement_period!: string;
  public credits_transferred!: number;
  public euro_value!: number;
  public settlement_status!: 'PENDING' | 'COMPLETED' | 'DISPUTED';
  public settlement_date?: Date;
  public notes?: string;
  public metadata?: any;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get settlements for a specific period
   */
  static async getSettlementsForPeriod(period: string): Promise<InterPropertySettlement[]> {
    return await this.findAll({
      where: { settlement_period: period },
      order: [['created_at', 'ASC']]
    });
  }

  /**
   * Get pending settlements
   */
  static async getPendingSettlements(): Promise<InterPropertySettlement[]> {
    return await this.findAll({
      where: { settlement_status: 'PENDING' },
      order: [['settlement_period', 'ASC'], ['created_at', 'ASC']]
    });
  }

  /**
   * Get settlements for a property (as origin or destination)
   */
  static async getPropertySettlements(
    propertyId: number,
    role: 'ORIGIN' | 'DESTINATION' | 'BOTH' = 'BOTH'
  ): Promise<InterPropertySettlement[]> {
    const where: any = {};

    if (role === 'ORIGIN') {
      where.origin_property_id = propertyId;
    } else if (role === 'DESTINATION') {
      where.destination_property_id = propertyId;
    } else {
      where[Op.or] = [
        { origin_property_id: propertyId },
        { destination_property_id: propertyId }
      ];
    }

    return await this.findAll({
      where,
      order: [['settlement_period', 'DESC'], ['created_at', 'DESC']]
    });
  }

  /**
   * Calculate total settlements between two properties
   */
  static async calculateTotalsBetweenProperties(
    propertyId1: number,
    propertyId2: number,
    period?: string
  ): Promise<{ property1Owes: number; property2Owes: number }> {
    const where: any = {
      settlement_status: 'COMPLETED',
      [Op.or]: [
        { origin_property_id: propertyId1, destination_property_id: propertyId2 },
        { origin_property_id: propertyId2, destination_property_id: propertyId1 }
      ]
    };

    if (period) {
      where.settlement_period = period;
    }

    const settlements = await this.findAll({ where });

    let property1Owes = 0;
    let property2Owes = 0;

    settlements.forEach(settlement => {
      if (settlement.origin_property_id === propertyId1) {
        property1Owes += Number(settlement.euro_value);
      } else {
        property2Owes += Number(settlement.euro_value);
      }
    });

    return { property1Owes, property2Owes };
  }

  /**
   * Create settlement record
   */
  static async createSettlement(
    bookingId: number,
    originPropertyId: number,
    destinationPropertyId: number,
    creditsTransferred: number,
    euroValue: number,
    period: string,
    metadata?: any,
    transaction?: any
  ): Promise<InterPropertySettlement> {
    return await this.create({
      booking_id: bookingId,
      origin_property_id: originPropertyId,
      destination_property_id: destinationPropertyId,
      settlement_period: period,
      credits_transferred: creditsTransferred,
      euro_value: euroValue,
      settlement_status: 'PENDING',
      metadata
    }, { transaction });
  }

  /**
   * Mark settlement as completed
   */
  static async completeSettlement(
    settlementId: number,
    notes?: string,
    transaction?: any
  ): Promise<InterPropertySettlement> {
    const settlement = await this.findByPk(settlementId, { transaction });
    if (!settlement) {
      throw new Error('Settlement not found');
    }

    await settlement.update(
      {
        settlement_status: 'COMPLETED',
        settlement_date: new Date(),
        notes
      },
      { transaction }
    );

    return settlement;
  }

  /**
   * Mark settlement as disputed
   */
  static async disputeSettlement(
    settlementId: number,
    notes: string,
    transaction?: any
  ): Promise<InterPropertySettlement> {
    const settlement = await this.findByPk(settlementId, { transaction });
    if (!settlement) {
      throw new Error('Settlement not found');
    }

    await settlement.update(
      {
        settlement_status: 'DISPUTED',
        notes
      },
      { transaction }
    );

    return settlement;
  }

  /**
   * Generate settlement period string (e.g., "2025-01" for January 2025)
   */
  static generatePeriod(date: Date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }
}

InterPropertySettlement.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'bookings',
        key: 'id',
      },
    },
    origin_property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'properties',
        key: 'id',
      },
    },
    destination_property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'properties',
        key: 'id',
      },
    },
    settlement_period: {
      type: DataTypes.STRING(7),
      allowNull: false,
      comment: 'Format: YYYY-MM',
    },
    credits_transferred: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    euro_value: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    settlement_status: {
      type: DataTypes.ENUM('PENDING', 'COMPLETED', 'DISPUTED'),
      allowNull: false,
      defaultValue: 'PENDING',
    },
    settlement_date: {
      type: DataTypes.DATE(3),
      allowNull: true,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    metadata: {
      type: DataTypes.JSON,
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
    tableName: 'inter_property_settlements',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['booking_id'] },
      { fields: ['origin_property_id', 'destination_property_id'] },
      { fields: ['settlement_period'] },
      { fields: ['settlement_status'] },
    ],
  }
);

export default InterPropertySettlement;
