import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

interface PropertyTierAttributes {
  id: number;
  tier_code: string;
  tier_name: string;
  location_multiplier: number;
  description?: string;
  display_order: number;
  properties_list?: string;
  created_at: Date;
  updated_at: Date;
}

interface PropertyTierCreationAttributes extends Omit<PropertyTierAttributes, 'id' | 'created_at' | 'updated_at'> {}

class PropertyTier extends Model<PropertyTierAttributes, PropertyTierCreationAttributes> implements PropertyTierAttributes {
  public id!: number;
  public tier_code!: string;
  public tier_name!: string;
  public location_multiplier!: number;
  public description?: string;
  public display_order!: number;
  public properties_list?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get tier by code
   */
  static async getByCode(code: string): Promise<PropertyTier | null> {
    return await this.findOne({ where: { tier_code: code } });
  }

  /**
   * Get all tiers ordered by display order
   */
  static async getAllOrdered(): Promise<PropertyTier[]> {
    return await this.findAll({
      order: [['display_order', 'ASC']]
    });
  }
}

PropertyTier.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    tier_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    tier_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    location_multiplier: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    display_order: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    properties_list: {
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
    tableName: 'property_tiers',
    timestamps: true,
    underscored: true,
  }
);

export default PropertyTier;
