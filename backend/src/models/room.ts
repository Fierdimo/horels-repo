import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';



interface RoomAttributes {
  id: number;
  name: string;
  description?: string;
  capacity: number;
  type?: string;
  floor?: string;
  status: string;
  amenities?: any;
  basePrice?: number;
  propertyId?: number;
  pmsResourceId?: string; // ID en el PMS
  isMarketplaceEnabled?: boolean; // Disponible en marketplace público
  customPrice?: number; // Precio personalizado (override)
  pmsLastSync?: Date; // Última sincronización con PMS
  images?: string[]; // URLs de imágenes
  createdAt?: Date;
  updatedAt?: Date;
}

interface RoomCreationAttributes extends Optional<RoomAttributes, 'id' | 'description'> {}


class Room extends Model<RoomAttributes, RoomCreationAttributes> implements RoomAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
  public capacity!: number;
  public type?: string;
  public floor?: string;
  public status!: string;
  public amenities?: any;
  public basePrice?: number;
  public propertyId?: number;
  public pmsResourceId?: string;
  public isMarketplaceEnabled?: boolean;
  public customPrice?: number;
  public pmsLastSync?: Date;
  public images?: string[];
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}


Room.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      // Unique per property, not globally
    },
    description: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },
    type: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    floor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING,
      allowNull: false,
      defaultValue: 'available',
    },
    amenities: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    basePrice: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: true,
    },
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'properties',
        key: 'id',
      },
      field: 'property_id',
    },
    pmsResourceId: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: 'pms_resource_id',
    },
    isMarketplaceEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_marketplace_enabled',
    },
    customPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'custom_price',
    },
    pmsLastSync: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'pms_last_sync',
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
    },
  },
  {
    sequelize,
    modelName: 'Room',
    tableName: 'rooms',
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ['name', 'property_id'],
        name: 'rooms_name_property_unique',
      },
    ],
  }
);

import Property from './Property';
Room.belongsTo(Property, { foreignKey: 'property_id', as: 'Property' });

export default Room;
