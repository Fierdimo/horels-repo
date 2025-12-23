import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface UserAttributes {
  id?: number;
  email: string;
  password: string;
  role_id: number;
  property_id?: number | null;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  address?: string | null;
  stripe_customer_id?: string | null;
  stripe_payment_method_id?: string | null;
}

class User extends Model<UserAttributes> implements UserAttributes {
  public id!: number;
  public email!: string;
  public password!: string;
  public role_id!: number;
  public property_id?: number | null;
  public status!: 'pending' | 'approved' | 'rejected' | 'suspended';
  public firstName?: string | null;
  public lastName?: string | null;
  public phone?: string | null;
  public address?: string | null;
  public stripe_customer_id?: string | null;
  public stripe_payment_method_id?: string | null;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

User.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  role_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
  },
  property_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'suspended'),
    allowNull: false,
    defaultValue: 'pending',
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'first_name',
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: true,
    field: 'last_name',
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  address: {
    type: DataTypes.STRING,
    defaultValue: 'approved',
  },
  stripe_customer_id: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true,
  },
  stripe_payment_method_id: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  sequelize,
  tableName: 'users',
  timestamps: true,
});

export default User;