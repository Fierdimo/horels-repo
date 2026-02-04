import { Model, DataTypes, Sequelize } from 'sequelize';
import sequelize from '../../config/database';

class CreditSystemConfig extends Model {
  public id!: number;
  public config_key!: string;
  public config_value!: number;
  public config_type!: 'BASE_SEASON' | 'BASE_NIGHTLY' | 'TIER_MULTIPLIER' | 'ROOM_MULTIPLIER' | 'OTHER';
  public description!: string | null;
  public updated_at!: Date;
  public updated_by!: number | null;

  /**
   * Get configuration value by key with fallback
   */
  static async getValue(key: string, defaultValue: number): Promise<number> {
    try {
      const config = await this.findOne({ where: { config_key: key } });
      return config ? parseFloat(config.config_value.toString()) : defaultValue;
    } catch (error) {
      console.warn(`Error fetching config ${key}:`, error);
      return defaultValue;
    }
  }

  /**
   * Update or create configuration value
   */
  static async setValue(
    key: string,
    value: number,
    updatedBy: number | null = null
  ): Promise<void> {
    await this.upsert({
      config_key: key,
      config_value: value,
      updated_by: updatedBy,
      updated_at: new Date()
    });
  }

  /**
   * Get all configurations by type
   */
  static async getByType(type: string): Promise<CreditSystemConfig[]> {
    return await this.findAll({
      where: { config_type: type },
      order: [['config_key', 'ASC']]
    });
  }

  /**
   * Get all configurations grouped by type
   */
  static async getAllGrouped(): Promise<{
    base_seasons: Record<string, number>;
    base_nightly: Record<string, number>;
    tier_multipliers: Record<string, number>;
    room_multipliers: Record<string, number>;
    other: Record<string, number>;
  }> {
    const allConfigs = await this.findAll();

    const result = {
      base_seasons: {} as Record<string, number>,
      base_nightly: {} as Record<string, number>,
      tier_multipliers: {} as Record<string, number>,
      room_multipliers: {} as Record<string, number>,
      other: {} as Record<string, number>
    };

    for (const config of allConfigs) {
      const value = parseFloat(config.config_value.toString());
      const key = config.config_key.replace(/^(BASE_SEASON_|BASE_NIGHTLY_|TIER_|ROOM_)/, '');

      switch (config.config_type) {
        case 'BASE_SEASON':
          result.base_seasons[key] = value;
          break;
        case 'BASE_NIGHTLY':
          result.base_nightly[key] = value;
          break;
        case 'TIER_MULTIPLIER':
          result.tier_multipliers[key] = value;
          break;
        case 'ROOM_MULTIPLIER':
          result.room_multipliers[key] = value;
          break;
        case 'OTHER':
          result.other[config.config_key] = value;
          break;
      }
    }

    return result;
  }

  /**
   * Bulk update configurations
   */
  static async bulkUpdate(
    updates: Record<string, number>,
    updatedBy: number | null = null
  ): Promise<{ updated: string[]; errors: string[] }> {
    const updated: string[] = [];
    const errors: string[] = [];

    for (const [key, value] of Object.entries(updates)) {
      try {
        await this.setValue(key, value, updatedBy);
        updated.push(key);
      } catch (error) {
        console.error(`Error updating ${key}:`, error);
        errors.push(key);
      }
    }

    return { updated, errors };
  }
}

export function initCreditSystemConfig(sequelize: Sequelize): typeof CreditSystemConfig {
  CreditSystemConfig.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
      },
      config_key: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
      },
      config_value: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false
      },
      config_type: {
        type: DataTypes.ENUM(
          'BASE_SEASON',
          'BASE_NIGHTLY',
          'TIER_MULTIPLIER',
          'ROOM_MULTIPLIER',
          'OTHER'
        ),
        allowNull: false
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW
      },
      updated_by: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'users',
          key: 'id'
        }
      }
    },
    {
      sequelize,
      tableName: 'credit_system_config',
      timestamps: false,
      indexes: [
        { fields: ['config_type'] },
        { fields: ['config_key'], unique: true }
      ]
    }
  );
  
  return CreditSystemConfig;
}

export default CreditSystemConfig;
