import { Response } from 'express';
import { Booking, Room, Property, Week, User } from '../models';
import { AuthRequest } from '../middleware/authMiddleware';
import bookingStatusService from '../services/bookingStatusService';
import { Op } from 'sequelize';

class StaffBookingController {
  /**
   * Get all pending bookings for staff's property
   */
  async getPendingBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const propertyId = req.user?.property_id;

      if (!propertyId) {
        res.status(403).json({
          success: false,
          error: 'Staff user must be associated with a property'
        });
        return;
      }

      const pendingBookings = await Booking.findAll({
        where: {
          property_id: propertyId,
          status: 'pending'
        },
        include: [
          {
            model: Room,
            as: 'Room',
            attributes: ['id', 'name', 'type', 'capacity', 'status']
          },
          {
            model: Property,
            as: 'Property',
            attributes: ['id', 'name', 'location']
          }
        ],
        order: [['created_at', 'ASC']] // Más antiguas primero
      });

      res.json({
        success: true,
        data: pendingBookings,
        count: pendingBookings.length
      });
    } catch (error: any) {
      console.error('Error fetching pending bookings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch pending bookings',
        message: error.message
      });
    }
  }

  /**
   * Get all bookings (with filters) for staff's property
   */
  async getAllBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const propertyId = req.user?.property_id;
      const { status, start_date, end_date, room_id } = req.query;

      if (!propertyId) {
        res.status(403).json({
          success: false,
          error: 'Staff user must be associated with a property'
        });
        return;
      }

      const where: any = {
        property_id: propertyId
      };

      if (status) {
        where.status = status;
      }

      if (room_id) {
        where.room_id = room_id;
      }

      if (start_date || end_date) {
        where.check_in = {};
        if (start_date) where.check_in[Op.gte] = new Date(start_date as string);
        if (end_date) where.check_in[Op.lte] = new Date(end_date as string);
      }

      const bookings = await Booking.findAll({
        where,
        include: [
          {
            model: Room,
            as: 'Room',
            attributes: ['id', 'name', 'type', 'capacity', 'status']
          }
        ],
        order: [['created_at', 'DESC']]
      });

      res.json({
        success: true,
        data: bookings,
        count: bookings.length
      });
    } catch (error: any) {
      console.error('Error fetching bookings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch bookings',
        message: error.message
      });
    }
  }

  /**
   * Approve a pending booking
   */
  async approveBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const propertyId = req.user?.property_id;

      if (!propertyId) {
        res.status(403).json({
          success: false,
          error: 'Staff user must be associated with a property'
        });
        return;
      }

      // Buscar el booking pendiente
      const booking = await Booking.findOne({
        where: {
          id,
          property_id: propertyId,
          status: 'pending'
        },
        include: [
          {
            model: Room,
            as: 'Room'
          }
        ]
      });

      if (!booking) {
        res.status(404).json({
          success: false,
          error: 'Pending booking not found'
        });
        return;
      }

      // Verificar disponibilidad nuevamente (por si hubo cambios)
      if (booking.room_id) {
        const isAvailable = await bookingStatusService.checkRoomAvailability(
          booking.room_id,
          booking.check_in,
          booking.check_out
        );

        if (!isAvailable) {
          res.status(409).json({
            success: false,
            error: 'Room is no longer available for these dates'
          });
          return;
        }
      }

      // Cambiar estado a confirmed
      booking.status = 'confirmed';
      await booking.save();

      // Actualizar estado de la habitación
      if (booking.room_id) {
        await bookingStatusService.onBookingCreated(booking.id);
      }

      // CREATE WEEK with room's color when booking is approved
      const room = booking.get('Room') as any;
      if (booking.room_id && room && room.color) {
        // Find or create owner (guest becomes owner of this week)
        let owner = await User.findOne({
          where: { email: booking.guest_email }
        });

        if (!owner) {
          // Create a user for the guest
          owner = await User.create({
            email: booking.guest_email,
            first_name: booking.guest_name.split(' ')[0],
            last_name: booking.guest_name.split(' ').slice(1).join(' ') || '',
            role_id: 3, // Assuming role 3 is 'owner'
            status: 'approved',
            password_hash: '' // Will need to set password via email reset link
          });
        }

        // Create week with room's color
        await Week.create({
          owner_id: owner.id,
          property_id: booking.property_id,
          start_date: booking.check_in,
          end_date: booking.check_out,
          color: room.color,
          status: 'confirmed'
        });
      }

      // TODO: Enviar email de confirmación al guest
      // TODO: Procesar pago si es necesario

      res.json({
        success: true,
        message: 'Booking approved successfully',
        data: booking
      });
    } catch (error: any) {
      console.error('Error approving booking:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to approve booking',
        message: error.message
      });
    }
  }

  /**
   * Reject a pending booking
   */
  async rejectBooking(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { reason } = req.body;
      const propertyId = req.user?.property_id;

      if (!propertyId) {
        res.status(403).json({
          success: false,
          error: 'Staff user must be associated with a property'
        });
        return;
      }

      // Buscar el booking pendiente
      const booking = await Booking.findOne({
        where: {
          id,
          property_id: propertyId,
          status: 'pending'
        }
      });

      if (!booking) {
        res.status(404).json({
          success: false,
          error: 'Pending booking not found'
        });
        return;
      }

      // Cambiar estado a cancelled
      booking.status = 'cancelled';
      await booking.save();

      // TODO: Enviar email de rechazo al guest con la razón

      res.json({
        success: true,
        message: 'Booking rejected successfully',
        data: booking
      });
    } catch (error: any) {
      console.error('Error rejecting booking:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to reject booking',
        message: error.message
      });
    }
  }

  /**
   * Get booking statistics for staff dashboard
   */
  async getBookingStats(req: AuthRequest, res: Response): Promise<void> {
    try {
      const propertyId = req.user?.property_id;

      if (!propertyId) {
        res.status(403).json({
          success: false,
          error: 'Staff user must be associated with a property'
        });
        return;
      }

      const [totalBookings, pendingCount, confirmedCount, checkedInCount] = await Promise.all([
        Booking.count({ where: { property_id: propertyId } }),
        Booking.count({ where: { property_id: propertyId, status: 'pending' } }),
        Booking.count({ where: { property_id: propertyId, status: 'confirmed' } }),
        Booking.count({ where: { property_id: propertyId, status: 'checked_in' } })
      ]);

      res.json({
        success: true,
        data: {
          total: totalBookings,
          pending: pendingCount,
          confirmed: confirmedCount,
          checkedIn: checkedInCount
        }
      });
    } catch (error: any) {
      console.error('Error fetching booking stats:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch booking statistics',
        message: error.message
      });
    }
  }
}

export default new StaffBookingController();
