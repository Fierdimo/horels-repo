import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

/**
 * User Model (V2)
 * 
 * Unified user table for all user types: admin, owner, guest, staff
 * Matches the actual database schema with password_hash and role enum
 */

export type UserRole = 'admin' | 'owner' | 'guest' | 'staff';
export type UserStatus = 'active' | 'suspended' | 'inactive';

export interface UserAttributes {
  id: number;
  email: string;
  password_hash: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  role: UserRole;
  status: UserStatus;
  property_id?: number | null;
  email_verified?: boolean;
  email_verified_at?: Date | null;
  last_login_at?: Date | null;
  must_change_password?: boolean;
  stripe_customer_id?: string | null;
  password_reset_token?: string | null;
  password_reset_expires?: Date | null;
  created_at?: Date;
  updated_at?: Date;
}

// Define optional fields for creation
export interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'email_verified' | 'email_verified_at' | 'last_login_at' | 'stripe_customer_id' | 'password_reset_token' | 'password_reset_expires' | 'created_at' | 'updated_at'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public email!: string;
  public password_hash!: string;
  public first_name!: string;
  public last_name!: string;
  public phone?: string | null;
  public role!: UserRole;
  public status!: UserStatus;
  public property_id?: number | null;
  public email_verified?: boolean;
  public email_verified_at?: Date | null;
  public last_login_at?: Date | null;
  public must_change_password?: boolean;
  public stripe_customer_id?: string | null;
  public password_reset_token?: string | null;
  public password_reset_expires?: Date | null;
  
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Helper methods
  public get fullName(): string {
    return `${this.first_name} ${this.last_name}`;
  }

  public isAdmin(): boolean {
    return this.role === 'admin';
  }

  public isOwner(): boolean {
    return this.role === 'owner';
  }

  public isStaff(): boolean {
    return this.role === 'staff';
  }

  public isActive(): boolean {
    return this.status === 'active';
  }
}

export function initUser(sequelize: Sequelize): typeof User {
  User.init(
    {
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
      },
      first_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      last_name: {
        type: DataTypes.STRING(100),
        allowNull: false,
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
        type: DataTypes.ENUM('active', 'suspended', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
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
        allowNull: true,
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
        allowNull: true,
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
      created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at',
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at',
      },
    },
    {
      sequelize,
      tableName: 'users',
      timestamps: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        {
          fields: ['email'],
          unique: true,
        },
        {
          fields: ['role'],
        },
        {
          fields: ['stripe_customer_id'],
        },
      ],
    }
  );

  return User;
}

export default User;
