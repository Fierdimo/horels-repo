import { Model, DataTypes } from 'sequelize';
import sequelize from '../config/database';

interface BookingAncillaryServiceAttributes {
  id: number;
  booking_id: number;
  ancillary_service_id: number;
  quantity: number;
  credit_cost_at_booking: number;
  cash_price_at_booking?: number;
  total_credits: number;
  total_cash?: number;
  notes?: string;
  created_at: Date;
  updated_at: Date;
}

interface BookingAncillaryServiceCreationAttributes extends Omit<BookingAncillaryServiceAttributes, 'id' | 'created_at' | 'updated_at'> {}

class BookingAncillaryService extends Model<BookingAncillaryServiceAttributes, BookingAncillaryServiceCreationAttributes> implements BookingAncillaryServiceAttributes {
  public id!: number;
  public booking_id!: number;
  public ancillary_service_id!: number;
  public quantity!: number;
  public credit_cost_at_booking!: number;
  public cash_price_at_booking?: number;
  public total_credits!: number;
  public total_cash?: number;
  public notes?: string;
  public readonly created_at!: Date;
  public readonly updated_at!: Date;

  /**
   * Get all services for a booking
   */
  static async getBookingServices(bookingId: number): Promise<BookingAncillaryService[]> {
    return await this.findAll({
      where: { booking_id: bookingId },
      include: [
        {
          model: sequelize.models.AncillaryService,
          as: 'service'
        }
      ],
      order: [['created_at', 'ASC']]
    });
  }

  /**
   * Calculate total cost for booking services
   */
  static async calculateBookingServicesCost(bookingId: number): Promise<{ credits: number; cash: number }> {
    const services = await this.findAll({
      where: { booking_id: bookingId }
    });

    return services.reduce(
      (total, service) => ({
        credits: total.credits + Number(service.total_credits),
        cash: total.cash + Number(service.total_cash || 0)
      }),
      { credits: 0, cash: 0 }
    );
  }

  /**
   * Add service to booking
   */
  static async addServiceToBooking(
    bookingId: number,
    ancillaryServiceId: number,
    quantity: number,
    creditCost: number,
    cashPrice?: number,
    notes?: string,
    transaction?: any
  ): Promise<BookingAncillaryService> {
    const totalCredits = creditCost * quantity;
    const totalCash = cashPrice ? cashPrice * quantity : undefined;

    return await this.create({
      booking_id: bookingId,
      ancillary_service_id: ancillaryServiceId,
      quantity,
      credit_cost_at_booking: creditCost,
      cash_price_at_booking: cashPrice,
      total_credits: totalCredits,
      total_cash: totalCash,
      notes
    }, { transaction });
  }

  /**
   * Remove service from booking
   */
  static async removeServiceFromBooking(bookingId: number, ancillaryServiceId: number, transaction?: any): Promise<number> {
    return await this.destroy({
      where: {
        booking_id: bookingId,
        ancillary_service_id: ancillaryServiceId
      },
      transaction
    });
  }

  /**
   * Update service quantity
   */
  static async updateServiceQuantity(
    bookingId: number,
    ancillaryServiceId: number,
    quantity: number,
    transaction?: any
  ): Promise<[number]> {
    const service = await this.findOne({
      where: {
        booking_id: bookingId,
        ancillary_service_id: ancillaryServiceId
      }
    });

    if (!service) {
      throw new Error('Service not found in booking');
    }

    const totalCredits = service.credit_cost_at_booking * quantity;
    const totalCash = service.cash_price_at_booking ? service.cash_price_at_booking * quantity : undefined;

    return await this.update(
      {
        quantity,
        total_credits: totalCredits,
        total_cash: totalCash
      },
      {
        where: {
          booking_id: bookingId,
          ancillary_service_id: ancillaryServiceId
        },
        transaction
      }
    );
  }
}

BookingAncillaryService.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    booking_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'bookings',
        key: 'id',
      },
    },
    ancillary_service_id: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false,
      references: {
        model: 'ancillary_services',
        key: 'id',
      },
    },
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    credit_cost_at_booking: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    cash_price_at_booking: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
    },
    total_credits: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },
    total_cash: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: true,
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
    tableName: 'booking_ancillary_services',
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ['booking_id'] },
      { fields: ['ancillary_service_id'] },
    ],
  }
);

export default BookingAncillaryService;
