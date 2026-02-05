import { DataTypes, Model } from 'sequelize';
import sequelize from '../config/database';

interface UserAttributes {
  id?: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role: 'admin' | 'owner' | 'guest' | 'staff';
  status: 'pending' | 'approved' | 'rejected' | 'inactive';
  property_id?: number | null;
  email_verified?: boolean;
  email_verified_at?: Date | null;
  last_login_at?: Date | null;
  must_change_password?: boolean;
  stripe_customer_id?: string | null;
  password_reset_token?: string | null;
  password_reset_expires?: Date | null;
}

class User extends Model<UserAttributes> implements UserAttributes {
  public id!: number;
  public email!: string;
  public password_hash!: string;
  public first_name!: string;
  public last_name!: string;
  public phone?: string | null;
  public role!: 'admin' | 'owner' | 'guest' | 'staff';
  public status!: 'pending' | 'approved' | 'rejected' | 'inactive';
  public property_id?: number | null;
  public email_verified!: boolean;
  public email_verified_at?: Date | null;
  public last_login_at?: Date | null;
  public must_change_password!: boolean;
  public stripe_customer_id?: string | null;
  public password_reset_token?: string | null;
  public password_reset_expires?: Date | null;

  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Backwards compatibility getters for V1 code
  get firstName(): string { return this.first_name; }
  get lastName(): string { return this.last_name; }
}

User.init({
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
    autoIncrement: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  password_hash: {
    type: DataTypes.STRING(255),
    allowNull: false,
    field: 'password_hash',
  },
  first_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'first_name',
  },
  last_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    field: 'last_name',
  },
  phone: {
    type: DataTypes.STRING(50),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('admin', 'owner', 'guest', 'staff'),
    allowNull: false,
    defaultValue: 'guest',
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected', 'inactive'),
    allowNull: false,
    defaultValue: 'approved',
  },
  property_id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
    references: {
      model: 'timeshare_properties',
      key: 'id'
    },
    comment: 'Property assigned to staff users - only used for role=staff'
  },
  email_verified: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  email_verified_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  last_login_at: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  must_change_password: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'True if user has temporary password and must change it on first login'
  },
  stripe_customer_id: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  password_reset_token: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  password_reset_expires: {
    type: DataTypes.DATE,
    allowNull: true,
  },
}, {
  sequelize,
  tableName: 'users',
  timestamps: true,
  underscored: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});

export default User;