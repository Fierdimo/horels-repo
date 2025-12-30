import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

interface PlatformSettingsAttributes {
  id: number;
  setting_key: string;
  setting_value: string;
  setting_type: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  description?: string;
  updated_by?: number;
  created_at: Date;
  updated_at: Date;
}

interface PlatformSettingsCreationAttributes extends Omit<PlatformSettingsAttributes, 'id' | 'created_at' | 'updated_at'> {}

class PlatformSettings extends Model<PlatformSettingsAttributes, PlatformSettingsCreationAttributes> implements PlatformSettingsAttributes {
  public id!: number;
  public setting_key!: string;
  public setting_value!: string;
  public setting_type!: 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON';
  public description?: string;
  public updated_by?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get a setting value by key
   */
  static async getSetting(key: string): Promise<string | null> {
    const setting = await this.findOne({ where: { setting_key: key } });
    return setting ? setting.setting_value : null;
  }

  /**
   * Get a number setting
   */
  static async getNumberSetting(key: string, defaultValue: number = 0): Promise<number> {
    const value = await this.getSetting(key);
    return value ? parseFloat(value) : defaultValue;
  }

  /**
   * Get all settings as key-value object
   */
  static async getAllSettings(): Promise<Record<string, string>> {
    const settings = await this.findAll();
    const result: Record<string, string> = {};
    settings.forEach(s => {
      result[s.setting_key] = s.setting_value;
    });
    return result;
  }

  /**
   * Update or create a setting
   */
  static async updateSetting(key: string, value: string, userId?: number): Promise<PlatformSettings> {
    const [setting] = await this.findOrCreate({
      where: { setting_key: key },
      defaults: {
        setting_key: key,
        setting_value: value,
        setting_type: 'STRING',
        updated_by: userId
      }
    });

    if (setting.setting_value !== value) {
      await setting.update({
        setting_value: value,
        updated_by: userId
      });
    }

    return setting;
  }
}

PlatformSettings.init(
  {
    id: {
      type: DataTypes.INTEGER,
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
      references: {
        model: 'users',
        key: 'id',
      },
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'platform_settings',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['setting_key'], unique: true },
    ],
  }
);

export default PlatformSettings;
