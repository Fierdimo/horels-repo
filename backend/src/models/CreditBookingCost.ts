import { Model, DataTypes, Op } from 'sequelize';
import sequelize from '../config/database';

interface CreditBookingCostAttributes {
  id: number;
  property_id: number;
  room_type: 'STANDARD' | 'SUPERIOR' | 'DELUXE' | 'SUITE' | 'PRESIDENTIAL';
  season_type: 'RED' | 'WHITE' | 'BLUE';
  credits_per_night: number;
  effective_from: Date;
  effective_until?: Date;
  is_active: boolean;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface CreditBookingCostCreationAttributes extends Omit<CreditBookingCostAttributes, 'id' | 'created_at' | 'updated_at'> {}

class CreditBookingCost extends Model<CreditBookingCostAttributes, CreditBookingCostCreationAttributes> implements CreditBookingCostAttributes {
  public id!: number;
  public property_id!: number;
  public room_type!: 'STANDARD' | 'SUPERIOR' | 'DELUXE' | 'SUITE' | 'PRESIDENTIAL';
  public season_type!: 'RED' | 'WHITE' | 'BLUE';
  public credits_per_night!: number;
  public effective_from!: Date;
  public effective_until?: Date;
  public is_active!: boolean;
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get cost for specific property, room type, and season
   */
  static async getCost(propertyId: number, roomType: string, seasonType: string, date: Date = new Date()): Promise<CreditBookingCost | null> {
    return await this.findOne({
      where: {
        property_id: propertyId,
        room_type: roomType,
        season_type: seasonType,
        is_active: true,
        effective_from: { [Op.lte]: date },
        [Op.or]: [
          { effective_until: { [Op.is]: null } },
          { effective_until: { [Op.gte]: date } }
        ]
      } as any,
      order: [['effective_from', 'DESC']]
    });
  }

  /**
   * Get all active costs for a property
   */
  static async getPropertyCosts(propertyId: number): Promise<CreditBookingCost[]> {
    return await this.findAll({
      where: {
        property_id: propertyId,
        is_active: true
      },
      order: [
        ['season_type', 'ASC'],
        ['room_type', 'ASC']
      ]
    });
  }

  /**
   * Get all costs for a specific date range (useful for pricing matrix)
   */
  static async getCostsForDateRange(propertyId: number, startDate: Date, endDate: Date): Promise<CreditBookingCost[]> {
    return await this.findAll({
      where: {
        property_id: propertyId,
        is_active: true,
        effective_from: { [Op.lte]: endDate },
        [Op.or]: [
          { effective_until: { [Op.is]: null } },
          { effective_until: { [Op.gte]: startDate } }
        ]
      } as any
    });
  }

  /**
   * Deactivate old prices and create new ones (for price updates)
   */
  static async updatePrices(
    propertyId: number,
    newPrices: Array<{ roomType: string; seasonType: string; creditsPerNight: number }>,
    effectiveFrom: Date,
    transaction?: any
  ): Promise<void> {
    // Deactivate all current prices for this property
    await this.update(
      { 
        is_active: false,
        effective_until: effectiveFrom
      },
      {
        where: {
          property_id: propertyId,
          is_active: true
        },
        transaction
      }
    );

    // Create new prices
    const prices = newPrices.map(price => ({
      property_id: propertyId,
      room_type: price.roomType as any,
      season_type: price.seasonType as any,
      credits_per_night: price.creditsPerNight,
      effective_from: effectiveFrom,
      is_active: true
    }));

    await this.bulkCreate(prices, { transaction });
  }
}

CreditBookingCost.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'properties',
        key: 'id',
      },
    },
    room_type: {
      type: DataTypes.ENUM('STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'),
      allowNull: false,
    },
    season_type: {
      type: DataTypes.ENUM('RED', 'WHITE', 'BLUE'),
      allowNull: false,
    },
    credits_per_night: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    effective_from: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    effective_until: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: 'credit_booking_costs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['property_id', 'room_type', 'season_type', 'is_active'] },
      { fields: ['effective_from'] },
      { fields: ['is_active'] },
    ],
  }
);

export default CreditBookingCost;
