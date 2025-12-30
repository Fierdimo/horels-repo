import { DataTypes, Model, Optional } from 'sequelize';
import sequelize from '../config/database';

interface OwnerInvitationAttributes {
  id: number;
  token: string;
  email: string;
  first_name?: string;
  last_name?: string;
  created_by_staff_id: number;
  property_id: number; // Staff's property - required
  rooms_data: Array<{
    room_id: number;
    start_date: string;
    end_date: string;
    room_type: string; // For credit calculation
  }>;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  acceptance_type?: 'booking' | 'credits'; // How owner accepted
  accepted_at?: Date;
  created_user_id?: number;
  expires_at: Date;
  created_at?: Date;
  updated_at?: Date;
}

interface OwnerInvitationCreationAttributes
  extends Optional<OwnerInvitationAttributes, 'id' | 'first_name' | 'last_name' | 'acceptance_type' | 'accepted_at' | 'created_user_id' | 'created_at' | 'updated_at'> {}

class OwnerInvitation extends Model<OwnerInvitationAttributes, OwnerInvitationCreationAttributes>
  implements OwnerInvitationAttributes {
  public id!: number;
  public token!: string;
  public email!: string;
  public first_name?: string;
  public last_name?: string;
  public created_by_staff_id!: number;
  public property_id!: number; // Staff's property - required
  public rooms_data!: Array<{
    room_id: number;
    start_date: string;
    end_date: string;
    room_type: string;
  }>;
  public status!: 'pending' | 'accepted' | 'expired' | 'cancelled';
  public acceptance_type?: 'booking' | 'credits';
  public accepted_at?: Date;
  public created_user_id?: number;
  public expires_at!: Date;
  public readonly created_at?: Date;
  public readonly updated_at?: Date;

  // Association properties
  public property?: any;
  public createdByStaff?: any;
  public createdUser?: any;

  // Check if invitation is still valid
  public isValid(): boolean {
    return this.status === 'pending' && new Date() < new Date(this.expires_at);
  }

  // Generate invitation link
  public getInvitationLink(frontendUrl: string): string {
    return `${frontendUrl}/register?invitation=${this.token}`;
  }
}

OwnerInvitation.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    token: {
      type: DataTypes.STRING(64),
      unique: true,
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      validate: {
        isEmail: true,
      },
    },
    first_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    last_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_by_staff_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    property_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'properties',
        key: 'id',
      },
    },
    rooms_data: {
      type: DataTypes.JSON,
      allowNull: false,
      validate: {
        isValidRoomsData(value: any) {
          if (!Array.isArray(value) || value.length === 0) {
            throw new Error('rooms_data must be a non-empty array');
          }
          value.forEach((room: any) => {
            if (!room.room_id || !room.start_date || !room.end_date || !room.room_type) {
              throw new Error('Each room must have room_id, start_date, end_date, and room_type');
            }
          });
        },
      },
    },
    acceptance_type: {
      type: DataTypes.ENUM('booking', 'credits'),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'expired', 'cancelled'),
      defaultValue: 'pending',
      allowNull: false,
    },
    accepted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    created_user_id: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    expires_at: {
      type: DataTypes.DATE,
      allowNull: false,
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
    tableName: 'owner_invitations',
    timestamps: true,
    underscored: true,
  }
);

export default OwnerInvitation;
