import { Model, DataTypes, Sequelize } from 'sequelize';

/**
 * OwnerProfile Model (V2)
 *
 * Extended profile for timeshare owners with Italian fiscal/contact fields.
 * Links 1:1 to users (role=owner). Populated by bulk import or manual edit.
 *
 * See: docs_v2/DATABASE_DESIGN.md - Table 10 (owner_profiles)
 */
class OwnerProfile extends Model {
  public id!: number;
  public user_id!: number; // FK → users.id (unique)

  // Name (denormalised for fast listing; authoritative source for imported data)
  public full_name!: string | null;

  // Postal address
  public address!: string | null;
  public postal_code!: string | null;
  public city!: string | null;
  public province!: string | null;
  public country!: string | null;

  // Italian fiscal identifiers
  public tax_code!: string | null;  // Codice Fiscale
  public vat_number!: string | null; // Partita IVA

  // Additional contacts
  public phone_2!: string | null;
  public phone_3!: string | null;
  public fax!: string | null;
  public pec!: string | null; // Posta Elettronica Certificata

  // Timestamps
  public readonly created_at!: Date;
  public readonly updated_at!: Date;
}

export function initOwnerProfile(sequelize: Sequelize): typeof OwnerProfile {
  OwnerProfile.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        primaryKey: true,
        autoIncrement: true,
      },
      user_id: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        unique: true,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      full_name: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      address: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      postal_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      province: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true,
        defaultValue: 'Italy',
      },
      tax_code: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      vat_number: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      phone_2: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      phone_3: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      fax: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      pec: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'owner_profiles',
      timestamps: true,
      underscored: true,
      createdAt: 'created_at',
      updatedAt: 'updated_at',
      indexes: [
        { fields: ['full_name'], name: 'idx_owner_profiles_full_name' },
        { fields: ['tax_code'], name: 'idx_owner_profiles_tax_code' },
        { fields: ['vat_number'], name: 'idx_owner_profiles_vat' },
      ],
    }
  );

  return OwnerProfile;
}

export default OwnerProfile;
