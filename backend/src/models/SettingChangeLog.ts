import { Model, DataTypes, Op } from 'sequelize';
import sequelize from '../config/database';

interface SettingChangeLogAttributes {
  id: number;
  setting_key: string;
  old_value?: string;
  new_value: string;
  changed_by: number;
  change_reason?: string;
  created_at: Date;
}

interface SettingChangeLogCreationAttributes extends Omit<SettingChangeLogAttributes, 'id' | 'created_at'> {}

class SettingChangeLog extends Model<SettingChangeLogAttributes, SettingChangeLogCreationAttributes> implements SettingChangeLogAttributes {
  public id!: number;
  public setting_key!: string;
  public old_value?: string;
  public new_value!: string;
  public changed_by!: number;
  public change_reason?: string;
  public readonly created_at!: Date;

  /**
   * Get change history for a specific setting
   */
  static async getSettingHistory(settingKey: string, limit: number = 50): Promise<SettingChangeLog[]> {
    return await this.findAll({
      where: { setting_key: settingKey },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Get recent changes (all settings)
   */
  static async getRecentChanges(limit: number = 100): Promise<SettingChangeLog[]> {
    return await this.findAll({
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Get changes by user
   */
  static async getChangesByUser(userId: number, limit: number = 50): Promise<SettingChangeLog[]> {
    return await this.findAll({
      where: { changed_by: userId },
      order: [['created_at', 'DESC']],
      limit
    });
  }

  /**
   * Log a setting change
   */
  static async logChange(
    settingKey: string,
    oldValue: string | null,
    newValue: string,
    changedBy: number,
    changeReason?: string,
    transaction?: any
  ): Promise<SettingChangeLog> {
    return await this.create({
      setting_key: settingKey,
      old_value: oldValue || undefined,
      new_value: newValue,
      changed_by: changedBy,
      change_reason: changeReason
    }, { transaction });
  }

  /**
   * Get changes within date range
   */
  static async getChangesInRange(startDate: Date, endDate: Date): Promise<SettingChangeLog[]> {
    return await this.findAll({
      where: {
        created_at: {
          [Op.between]: [startDate, endDate]
        }
      },
      order: [['created_at', 'ASC']]
    });
  }

  /**
   * Get audit trail for critical settings
   */
  static async getCriticalSettingsAudit(criticalKeys: string[]): Promise<SettingChangeLog[]> {
    return await this.findAll({
      where: {
        setting_key: {
          [Op.in]: criticalKeys
        }
      },
      order: [['created_at', 'DESC']]
    });
  }
}

SettingChangeLog.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    setting_key: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    old_value: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    new_value: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    changed_by: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    change_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'setting_change_log',
    timestamps: false,
    underscored: true,
    indexes: [
      { fields: ['setting_key', 'created_at'] },
      { fields: ['changed_by'] },
      { fields: ['created_at'] },
    ],
  }
);

export default SettingChangeLog;
