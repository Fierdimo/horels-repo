import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

// Actual database table structure (DESCRIBE rooms):
// - id, name, description, capacity, createdAt, updatedAt
interface RoomAttributes {
  id: number;
  name: string;
  description?: string;
  capacity: number;
  createdAt?: Date;
  updatedAt?: Date;
}

interface RoomCreationAttributes extends Optional<RoomAttributes, 'id' | 'description'> {}

class Room extends Model<RoomAttributes, RoomCreationAttributes> implements RoomAttributes {
  public id!: number;
  public name!: string;
  public description?: string;
  public capacity!: number;
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
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    description: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    capacity: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      defaultValue: 1,
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
