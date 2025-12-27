import { Model, DataTypes, Op } from 'sequelize';
import sequelize from '../config/database';

interface AncillaryServiceAttributes {
  id: number;
  property_id?: number;
  service_code: string;
  service_name: string;
  description?: string;
  price_credits?: number;
  price_euros?: number;
  category: 'CLEANING' | 'MINIBAR' | 'PARKING' | 'BREAKFAST' | 'SPA' | 'EXCURSION' | 'TRANSPORT' | 'OTHER';
  is_mandatory: boolean;
  is_active: boolean;
  display_order: number;
  created_at: Date;
  updated_at: Date;
}

interface AncillaryServiceCreationAttributes extends Omit<AncillaryServiceAttributes, 'id' | 'created_at' | 'updated_at'> {}

class AncillaryService extends Model<AncillaryServiceAttributes, AncillaryServiceCreationAttributes> implements AncillaryServiceAttributes {
  public id!: number;
  public property_id?: number;
  public service_code!: string;
  public service_name!: string;
  public description?: string;
  public price_credits?: number;
  public price_euros?: number;
  public category!: 'CLEANING' | 'MINIBAR' | 'PARKING' | 'BREAKFAST' | 'SPA' | 'EXCURSION' | 'TRANSPORT' | 'OTHER';
  public is_mandatory!: boolean;
  public is_active!: boolean;
  public display_order!: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get all active services for a property (or global services)
   */
  static async getActiveServices(propertyId?: number): Promise<AncillaryService[]> {
    const where: any = {
      is_active: true
    };

    if (propertyId) {
      where[Op.or] = [
        { property_id: propertyId },
        { property_id: null } // Global services
      ];
    } else {
      where.property_id = null; // Only global services
    }

    return await this.findAll({
      where,
      order: [
        ['category', 'ASC'],
        ['display_order', 'ASC']
      ]
    });
  }

  /**
   * Get mandatory services for a property
   */
  static async getMandatoryServices(propertyId?: number): Promise<AncillaryService[]> {
    const where: any = {
      is_active: true,
      is_mandatory: true
    };

    if (propertyId) {
      where[Op.or] = [
        { property_id: propertyId },
        { property_id: null }
      ];
    } else {
      where.property_id = null;
    }

    return await this.findAll({ where });
  }

  /**
   * Get services by category
   */
  static async getByCategory(category: string, propertyId?: number): Promise<AncillaryService[]> {
    const where: any = {
      is_active: true,
      category
    };

    if (propertyId) {
      where[Op.or] = [
        { property_id: propertyId },
        { property_id: null }
      ];
    } else {
      where.property_id = null;
    }

    return await this.findAll({
      where,
      order: [['display_order', 'ASC']]
    });
  }

  /**
   * Get service by code
   */
  static async getByCode(serviceCode: string, propertyId?: number): Promise<AncillaryService | null> {
    const where: any = {
      service_code: serviceCode,
      is_active: true
    };

    if (propertyId) {
      where[Op.or] = [
        { property_id: propertyId },
        { property_id: null }
      ];
    }

    return await this.findOne({ where });
  }

  /**
   * Calculate total cost for multiple services
   */
  static calculateTotalCost(services: AncillaryService[]): { credits: number; cash: number } {
    return services.reduce(
      (total, service) => ({
        credits: total.credits + Number(service.price_credits || 0),
        cash: total.cash + Number(service.price_euros || 0)
      }),
      { credits: 0, cash: 0 }
    );
  }
}

AncillaryService.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'properties',
        key: 'id',
      },
    },
    service_code: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    service_name: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    price_credits: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    price_euros: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    category: {
      type: DataTypes.ENUM('CLEANING', 'MINIBAR', 'PARKING', 'BREAKFAST', 'SPA', 'EXCURSION', 'TRANSPORT', 'OTHER'),
      allowNull: false,
      defaultValue: 'OTHER',
    },
    is_mandatory: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    display_order: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
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
    tableName: 'ancillary_services',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['service_code'], unique: true },
      { fields: ['property_id', 'is_active'] },
      { fields: ['category'] },
      { fields: ['is_mandatory'] },
    ],
  }
);

export default AncillaryService;
