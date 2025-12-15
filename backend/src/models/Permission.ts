import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface PermissionAttributes {
  id: number;
  name: string;
}

class Permission extends Model<PermissionAttributes> implements PermissionAttributes {
  public id!: number;
  public name!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Permission.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
}, {
  sequelize,
  tableName: 'permissions',
  timestamps: true,
});

export default Permission;