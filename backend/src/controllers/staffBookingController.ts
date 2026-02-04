import { Response } from 'express';
import { AuthRequest } from '../middleware/authMiddleware';
import { Op } from 'sequelize';

// V2 Models
import V2Booking from '../models/v2/V2Booking';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import WeekAllocation from '../models/v2/WeekAllocation';
import UserV2 from '../models/v2/User';

class StaffBookingController {
  /**
   * Get all pending bookings for staff's property (V2)
   * Returns bookings from v2_bookings table
   */
  async getPendingBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      // 🔍 DEBUG: Verificar contenido del token JWT
      console.log('\n=== JWT TOKEN DEBUG ===');
      console.log('Full req.user:', JSON.stringify(req.user, null, 2));
      console.log('property_id value:', req.user?.property_id);
      console.log('property_id type:', typeof req.user?.property_id);
      console.log('=====================\n');

      const propertyId = req.user?.property_id;

      if (!propertyId) {
        res.status(403).json({
          success: false,
          error: 'Staff user must be associated with a property. Please log out and log in again.'
        });
        return;
      }

      // V2: Get bookings with status PENDING (not pending_confirmation)
      const pendingBookings = await V2Booking.findAll({
        where: {
          property_id: propertyId,
          status: 'PENDING'
        },
        include: [
          {
            model: TimeshareProperty,
            as: 'property',
            attributes: ['id', 'name', 'city', 'country']
          },
          {
            model: WeekAllocation,
            as: 'weekAllocations',
            attributes: ['id', 'start_date', 'end_date', 'status']
          }
        ],
        order: [['created_at', 'ASC']]
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
   * Get all bookings (with filters) for staff's property (V2)
   */
  async getAllBookings(req: AuthRequest, res: Response): Promise<void> {
    try {
      const propertyId = req.user?.property_id;
      const { status, start_date, end_date } = req.query;

      if (!propertyId) {
        res.status(403).json({
          success: false,
          error: 'Staff user must be associated with a property. Please log out and log in again.'
        });
        return;
      }

      const where: any = {
        property_id: propertyId
      };

      if (status) {
        where.status = status;
      }

      if (start_date || end_date) {
        where.check_in = {};
        if (start_date) where.check_in[Op.gte] = new Date(start_date as string);
        if (end_date) where.check_in[Op.lte] = new Date(end_date as string);
      }

      const bookings = await V2Booking.findAll({
        where,
        include: [
          {
            model: TimeshareProperty,
            as: 'property',
            attributes: ['id', 'name', 'city']
          },
          {
            model: WeekAllocation,
            as: 'weekAllocations',
            attributes: ['id', 'start_date', 'end_date', 'week_number']
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
   * Approve a pending booking (V2)
   * Changes status from pending_confirmation to confirmed
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

      const booking = await V2Booking.findOne({
        where: {
          id,
          property_id: propertyId,
          status: 'PENDING'
        }
      });

      if (!booking) {
        res.status(404).json({
          success: false,
          error: 'Pending booking not found'
        });
        return;
      }

      // V2: Simple status change
      booking.status = 'CONFIRMED';
      await booking.save();

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

      // Build where clause
      const where: any = { id, status: 'pending' };
      if (propertyId) {
        where.property_id = propertyId;
      }

      // Buscar el booking pendiente
      const booking = await V2Booking.findOne({
        where
      });

      if (!booking) {
        res.status(404).json({
          success: false,
          error: 'Pending booking not found'
        });
        return;
      }

      // Cambiar estado a cancelled
      booking.status = 'CANCELLED';
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
   * Check-in a booking (V2)
   */
  async checkInBooking(req: AuthRequest, res: Response): Promise<void> {
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

      const booking = await V2Booking.findOne({
        where: {
          id,
          property_id: propertyId,
          status: 'confirmed'
        }
      });

      if (!booking) {
        res.status(404).json({
          success: false,
          error: 'Confirmed booking not found'
        });
        return;
      }

      booking.status = 'CHECKED_IN';
      await booking.save();

      res.json({
        success: true,
        message: 'Check-in completed successfully',
        data: booking
      });
    } catch (error: any) {
      console.error('Error during check-in:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete check-in',
        message: error.message
      });
    }
  }

  /**
   * Check-out a booking (V2)
   */
  async checkOutBooking(req: AuthRequest, res: Response): Promise<void> {
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

      const booking = await V2Booking.findOne({
        where: {
          id,
          property_id: propertyId,
          status: 'checked_in'
        }
      });

      if (!booking) {
        res.status(404).json({
          success: false,
          error: 'Checked-in booking not found'
        });
        return;
      }

      booking.status = 'CHECKED_OUT';
      await booking.save();

      res.json({
        success: true,
        message: 'Check-out completed successfully',
        data: booking
      });
    } catch (error: any) {
      console.error('Error during check-out:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to complete check-out',
        message: error.message
      });
    }
  }

  /**
   * Get booking statistics for staff dashboard (V2)
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

      const baseWhere: any = { property_id: propertyId };

      const [total, pending, confirmed, checkedIn] = await Promise.all([
        V2Booking.count({ where: baseWhere }),
        V2Booking.count({ where: { ...baseWhere, status: 'PENDING' } }),
        V2Booking.count({ where: { ...baseWhere, status: 'CONFIRMED' } }),
        V2Booking.count({ where: { ...baseWhere, status: 'CHECKED_IN' } })
      ]);

      res.json({
        success: true,
        data: {
          total: total,
          pending: pending,
          confirmed: confirmed,
          checkedIn: checkedIn
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
