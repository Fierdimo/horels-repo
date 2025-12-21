import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RoomAttributes {
  id: number;
  pmsResourceId: string; // ID en el PMS - Required, the only PMS reference we store
  propertyId: number; // FK to properties
  roomTypeId?: number; // FK to room_types - Local categorization
  customPrice?: number; // Precio personalizado (override)
  isMarketplaceEnabled?: boolean; // Disponible en marketplace público
  pmsLastSync?: Date; // Última sincronización con PMS
  images?: string[]; // URLs de imágenes
  createdAt?: Date;
  updatedAt?: Date;
}

interface RoomCreationAttributes extends Optional<RoomAttributes, 'id' | 'customPrice' | 'images' | 'pmsLastSync'> {}

class Room extends Model<RoomAttributes, RoomCreationAttributes> implements RoomAttributes {
  public id!: number;
  public pmsResourceId!: string;
  public propertyId!: number;
  public roomTypeId?: number;
  public customPrice?: number;
  public isMarketplaceEnabled?: boolean;
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
    pmsResourceId: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: 'pms_resource_id',
      comment: 'ID de la habitación en el PMS - Required, unique per property'
    },
    propertyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'properties',
        key: 'id',
      },
      field: 'property_id',
      comment: 'FK to properties'
    },
    roomTypeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'room_types',
        key: 'id',
      },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
      field: 'room_type_id',
      comment: 'Local categorization of room type'
    },
    customPrice: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
      field: 'custom_price',
      comment: 'Override price (takes precedence over PMS base price)'
    },
    isMarketplaceEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: 'is_marketplace_enabled',
      comment: 'Whether room is visible in public marketplace'
    },
    pmsLastSync: {
      type: DataTypes.DATE,
      allowNull: true,
      field: 'pms_last_sync',
      comment: 'Last synchronization timestamp with PMS'
    },
    images: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      comment: 'Array of image URLs for marketing purposes'
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
        fields: ['property_id', 'pms_resource_id'],
        name: 'rooms_property_pms_resource_unique',
      },
      {
        fields: ['room_type_id'],
        name: 'rooms_room_type_id_index',
      },
      {
        fields: ['property_id', 'is_marketplace_enabled'],
        name: 'idx_rooms_property_marketplace'
      },
    ],
  }
);

import Property from './Property';
import RoomType from './RoomType';

Room.belongsTo(Property, { foreignKey: 'property_id', as: 'Property' });
Room.belongsTo(RoomType, { foreignKey: 'room_type_id', as: 'RoomType' });

export default Room;
