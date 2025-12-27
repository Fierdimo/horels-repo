import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

interface RoomTypeMultiplierAttributes {
  id: number;
  room_type: string;
  multiplier: number;
  description?: string;
  display_order: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

interface RoomTypeMultiplierCreationAttributes extends Omit<RoomTypeMultiplierAttributes, 'id' | 'created_at' | 'updated_at'> {}

class RoomTypeMultiplier extends Model<RoomTypeMultiplierAttributes, RoomTypeMultiplierCreationAttributes> implements RoomTypeMultiplierAttributes {
  public id!: number;
  public room_type!: string;
  public multiplier!: number;
  public description?: string;
  public display_order!: number;
  public is_active!: boolean;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get multiplier by room type
   */
  static async getByRoomType(roomType: string): Promise<number> {
    const multiplier = await this.findOne({
      where: { room_type: roomType, is_active: true }
    });
    return multiplier ? parseFloat(multiplier.multiplier.toString()) : 1.0;
  }

  /**
   * Get all active room types
   */
  static async getAllActive(): Promise<RoomTypeMultiplier[]> {
    return await this.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC']]
    });
  }
}

RoomTypeMultiplier.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    room_type: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true,
    },
    multiplier: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: false,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    display_order: {
      type: DataTypes.TINYINT.UNSIGNED,
      allowNull: false,
      defaultValue: 0,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
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
    tableName: 'room_type_multipliers',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['is_active'] },
    ],
  }
);

export default RoomTypeMultiplier;
