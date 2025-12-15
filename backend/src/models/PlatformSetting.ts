import { DataTypes } from 'sequelize';
import sequelize from '../config/database';

// Simple key/value store for runtime-configurable platform settings
const PlatformSetting = sequelize.define('PlatformSetting', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  key: {
    type: DataTypes.STRING(128),
    allowNull: false,
    unique: true,
  },
  value: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'platform_settings',
  underscored: true,
  timestamps: true,
});

export default PlatformSetting;
