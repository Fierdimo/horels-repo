import { Model, DataTypes, Op } from 'sequelize';
import sequelize from '../config/database';

interface SeasonalCalendarAttributes {
  id: number;
  property_id: number;
  season_type: 'RED' | 'WHITE' | 'BLUE';
  start_date: Date;
  end_date: Date;
  year: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface SeasonalCalendarCreationAttributes extends Omit<SeasonalCalendarAttributes, 'id' | 'created_at' | 'updated_at'> {}

class SeasonalCalendar extends Model<SeasonalCalendarAttributes, SeasonalCalendarCreationAttributes> implements SeasonalCalendarAttributes {
  public id!: number;
  public property_id!: number;
  public season_type!: 'RED' | 'WHITE' | 'BLUE';
  public start_date!: Date;
  public end_date!: Date;
  public year!: number;
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get season for a specific property and date
   */
  static async getSeasonForDate(propertyId: number, date: Date): Promise<'RED' | 'WHITE' | 'BLUE' | null> {
    const season = await this.findOne({
      where: {
        property_id: propertyId,
        start_date: { [Op.lte]: date },
        end_date: { [Op.gte]: date }
      }
    });

    return season ? season.season_type : null;
  }

  /**
   * Get season for a date with fallback to default calendar
   * Returns the configured season or determines from default calendar if not configured
   */
  static async getSeasonForDateWithDefault(propertyId: number, date: Date): Promise<'RED' | 'WHITE' | 'BLUE'> {
    // Try to get configured season first
    const configuredSeason = await this.getSeasonForDate(propertyId, date);
    if (configuredSeason) {
      return configuredSeason;
    }

    // No configuration found, use default calendar logic
    const month = date.getMonth() + 1; // 1-12
    const day = date.getDate();
    
    // Default RED periods (High Season)
    // Dec 15-31 or Jul 1 - Aug 31
    if ((month === 12 && day >= 15) || (month === 7 || month === 8)) {
      return 'RED';
    }
    
    // Default WHITE periods (Mid Season)
    // Mar 15 - May 31 or Sep 15 - Nov 30
    if (
      (month === 3 && day >= 15) || 
      (month === 4 || month === 5) ||
      (month === 9 && day >= 15) ||
      (month === 10 || month === 11)
    ) {
      return 'WHITE';
    }
    
    // Default BLUE periods (Low Season)
    // Jan 1 - Mar 14, Jun, Sep 1-14, Dec 1-14
    return 'BLUE';
  }

  /**
   * Get all seasons for a property and year
   */
  static async getSeasonsForYear(propertyId: number, year: number): Promise<SeasonalCalendar[]> {
    return await this.findAll({
      where: { property_id: propertyId, year },
      order: [['start_date', 'ASC']]
    });
  }
}

SeasonalCalendar.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'properties',
        key: 'id',
      },
    },
    season_type: {
      type: DataTypes.ENUM('RED', 'WHITE', 'BLUE'),
      allowNull: false,
    },
    start_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    end_date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    year: {
      type: DataTypes.SMALLINT.UNSIGNED,
      allowNull: false,
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    updated_at: {
      type: DataTypes.DATE(3),
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'seasonal_calendar',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['property_id', 'start_date', 'end_date'] },
      { fields: ['property_id', 'year'] },
      { fields: ['season_type'] },
    ],
  }
);

export default SeasonalCalendar;
