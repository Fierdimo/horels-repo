import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';
import Property from './Property';
import User from './User';

// Attributes interface
export interface PMSSyncLogAttributes {
  id: number;
  property_id: number;
  sync_type: 'availability' | 'bookings' | 'prices' | 'full' | 'manual';
  status: 'pending' | 'running' | 'completed' | 'failed';
  started_at?: Date;
  completed_at?: Date;
  records_processed?: number;
  records_created?: number;
  records_updated?: number;
  records_failed?: number;
  errors?: string; // JSON string
  error_details?: string;
  triggered_by?: number;
  created_at?: Date;
  updated_at?: Date;
}

// Creation attributes (optional fields for INSERT)
export interface PMSSyncLogCreationAttributes
  extends Optional<
    PMSSyncLogAttributes,
    | 'id'
    | 'started_at'
    | 'completed_at'
    | 'records_processed'
    | 'records_created'
    | 'records_updated'
    | 'records_failed'
    | 'errors'
    | 'error_details'
    | 'triggered_by'
    | 'created_at'
    | 'updated_at'
  > {}

class PMSSyncLog extends Model<PMSSyncLogAttributes, PMSSyncLogCreationAttributes>
  implements PMSSyncLogAttributes {
  public id!: number;
  public property_id!: number;
  public sync_type!: 'availability' | 'bookings' | 'prices' | 'full' | 'manual';
  public status!: 'pending' | 'running' | 'completed' | 'failed';
  public started_at?: Date;
  public completed_at?: Date;
  public records_processed?: number;
  public records_created?: number;
  public records_updated?: number;
  public records_failed?: number;
  public errors?: string;
  public error_details?: string;
  public triggered_by?: number;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  // Helper methods
  public async markAsRunning(): Promise<void> {
    await this.update({
      status: 'running',
      started_at: new Date()
    });
  }

  public async markAsCompleted(stats?: {
    records_processed?: number;
    records_created?: number;
    records_updated?: number;
    records_failed?: number;
  }): Promise<void> {
    await this.update({
      status: 'completed',
      completed_at: new Date(),
      ...stats
    });
  }

  public async markAsFailed(error: string, errorDetails?: any): Promise<void> {
    await this.update({
      status: 'failed',
      completed_at: new Date(),
      errors: error,
      error_details: errorDetails ? JSON.stringify(errorDetails, null, 2) : undefined
    });
  }

  public addError(error: string): void {
    const errors = this.errors ? JSON.parse(this.errors) : [];
    errors.push({
      timestamp: new Date().toISOString(),
      message: error
    });
    this.errors = JSON.stringify(errors);
  }

  public getErrors(): Array<{ timestamp: string; message: string }> {
    if (!this.errors) return [];
    try {
      return JSON.parse(this.errors);
    } catch {
      return [];
    }
  }

  public getDuration(): number | null {
    if (!this.started_at) return null;
    const end = this.completed_at || new Date();
    return end.getTime() - this.started_at.getTime();
  }
}

PMSSyncLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'properties',
        key: 'id'
      }
    },
    sync_type: {
      type: DataTypes.ENUM('availability', 'bookings', 'prices', 'full', 'manual'),
      allowNull: false,
      defaultValue: 'manual'
    },
    status: {
      type: DataTypes.ENUM('pending', 'running', 'completed', 'failed'),
      allowNull: false,
      defaultValue: 'pending'
    },
    started_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completed_at: {
      type: DataTypes.DATE,
      allowNull: true
    },
    records_processed: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    records_created: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    records_updated: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    records_failed: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 0
    },
    errors: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    error_details: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    triggered_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id'
      }
    },
    created_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    },
    updated_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW
    }
  },
  {
    sequelize,
    tableName: 'pms_sync_logs',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['property_id'] },
      { fields: ['status'] },
      { fields: ['sync_type'] },
      { fields: ['created_at'] }
    ]
  }
);

// Associations
PMSSyncLog.belongsTo(Property, {
  foreignKey: 'property_id',
  as: 'property'
});

PMSSyncLog.belongsTo(User, {
  foreignKey: 'triggered_by',
  as: 'triggeredBy'
});

export default PMSSyncLog;
