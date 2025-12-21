import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface RoomTypeAttributes {
  id: number;
  name: string;
  description?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RoomTypeCreationAttributes extends Optional<RoomTypeAttributes, 'id'> {}

class RoomType extends Model<RoomTypeAttributes, RoomTypeCreationAttributes> implements RoomTypeAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

RoomType.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: 'RoomType',
    tableName: 'room_types',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  }
);

export default RoomType;
