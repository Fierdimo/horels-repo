import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

export type RoomStatus = 'available' | 'occupied' | 'maintenance' | 'unavailable';
export type RoomType = 'standard' | 'deluxe' | 'suite' | 'single' | 'double';
export type CreditRoomType = 'STANDARD' | 'SUPERIOR' | 'DELUXE' | 'SUITE' | 'PRESIDENTIAL';

interface RoomAttributes {
  id: number;
  name: string;
  description?: string | null;
  capacity: number;
  quantity: number;
  type: string;
  floor?: string | null;
  base_price: number;
  status: RoomStatus;
  images?: string | null; // JSON array stored as text
  is_marketplace_enabled: boolean;
  property_id?: number | null;
  credit_room_type?: CreditRoomType | null;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RoomCreationAttributes extends Optional<RoomAttributes,
  'id' | 'description' | 'floor' | 'images' | 'property_id' | 'quantity' | 'createdAt' | 'updatedAt'
> {}

class Room extends Model<RoomAttributes, RoomCreationAttributes> implements RoomAttributes {
  public id!: number;
  public name!: string;
  public description?: string | null;
  public capacity!: number;
  public quantity!: number;
  public type!: string;
  public floor?: string | null;
  public base_price!: number;
  public status!: RoomStatus;
  public images?: string | null;
  public is_marketplace_enabled!: boolean;
  public property_id?: number | null;
  public credit_room_type?: CreditRoomType | null;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  /** Parsed images array */
  get imageList(): string[] {
    if (!this.images) return [];
    try { return JSON.parse(this.images); } catch { return []; }
  }
}

Room.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },
    quantity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: 'standard',
    },
    floor: {
      type: DataTypes.STRING(20),
      allowNull: true,
    },
    base_price: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    status: {
      type: DataTypes.ENUM('available', 'occupied', 'maintenance', 'unavailable'),
      allowNull: false,
      defaultValue: 'available',
    },
    images: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    is_marketplace_enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    property_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    credit_room_type: {
      type: DataTypes.ENUM('STANDARD', 'SUPERIOR', 'DELUXE', 'SUITE', 'PRESIDENTIAL'),
      allowNull: true,
      defaultValue: null,
    },
  },
  {
    sequelize,
    modelName: 'Room',
    tableName: 'rooms',
    timestamps: true,
    indexes: [],
  }
);

export default Room;
