import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface UserPreferenceAttributes {
  id: number;
  user_id: number;
  email_notifications: boolean;
  swap_notifications: boolean;
  booking_notifications: boolean;
  marketing_emails: boolean;
  credit_expiry_alerts: boolean;
  weekly_summary: boolean;
  language?: string;
  timezone?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface UserPreferenceCreationAttributes extends Optional<UserPreferenceAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class UserPreference extends Model<UserPreferenceAttributes, UserPreferenceCreationAttributes> implements UserPreferenceAttributes {
  public id!: number;
  public user_id!: number;
  public email_notifications!: boolean;
  public swap_notifications!: boolean;
  public booking_notifications!: boolean;
  public marketing_emails!: boolean;
  public credit_expiry_alerts!: boolean;
  public weekly_summary!: boolean;
  public language?: string;
  public timezone?: string;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

UserPreference.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      references: {
        model: 'Users',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    email_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    swap_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    booking_notifications: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    marketing_emails: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    credit_expiry_alerts: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    weekly_summary: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    language: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    timezone: {
      type: DataTypes.STRING(50),
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: 'UserPreferences',
    timestamps: true,
  }
);

export default UserPreference;
