import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';
import Permission from './Permission';

interface RoleAttributes {
  id: number;
  name: string;
}

class Role extends Model<RoleAttributes> implements RoleAttributes {
  public id!: number;
  public name!: string;

  // Association: when included, Sequelize will add related Permissions
  public readonly Permissions?: Permission[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

Role.init({
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
  tableName: 'roles',
  timestamps: true,
});

export default Role;