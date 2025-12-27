import { DataTypes } from 'sequelize';
import sequelize from '../config/database';

// Simple key/value store for runtime-configurable platform settings
const PlatformSetting = sequelize.define('PlatformSetting', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  setting_key: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  setting_value: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  setting_type: {
    type: DataTypes.ENUM('STRING', 'NUMBER', 'BOOLEAN', 'JSON'),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  updated_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
  },
}, {
  tableName: 'platform_settings',
  underscored: true,
  timestamps: true,
});

export default PlatformSetting;
