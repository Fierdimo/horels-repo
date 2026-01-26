import { Router, Request, Response } from 'express';
import { Booking, Property, Room, User } from '../models';
import { authenticateToken } from '../middleware/authMiddleware';
import LoggingService from '../services/loggingService';
import { StripeService } from '../services/stripeService';
import PDFDocument from 'pdfkit';
import { Op } from 'sequelize';

interface AuthRequest extends Request {
  user?: User;
}

const router = Router();
const stripeService = new StripeService();

/**
 * @route   GET /api/bookings/my-bookings
 * @desc    Get all bookings for the authenticated user
 * @access  Private
 */
router.get('/my-bookings', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const offset = (Number(page) - 1) * Number(limit);

    const where: any = {
      [Op.or]: [
        { guest_email: req.user!.email },
        { '$User.id$': req.user!.id }
      ]
    };

    if (status) {
      where.status = status;
    }

    const { count, rows: bookings } = await Booking.findAndCountAll({
      where,
      include: [
        {
          model: Property,
          as: 'Property',
          attributes: ['id', 'name', 'location', 'city', 'country', 'images']
        },
        {
          model: Room,
          as: 'Room',
          attributes: ['id', 'name', 'type', 'description']
        },
        {
          model: User,
          as: 'User',
          required: false,
          attributes: []
        }
      ],
      order: [['check_in', 'DESC']],
      limit: Number(limit),
      offset,
      distinct: true
    });

    res.json({
      success: true,
      data: {
        bookings,
        pagination: {
          total: count,
          page: Number(page),
          limit: Number(limit),
          totalPages: Math.ceil(count / Number(limit))
        }
      }
    });
  } catch (error) {
    console.error('Error fetching user bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

/**
 * @route   GET /api/bookings/:id
 * @desc    Get booking details
 * @access  Private (own bookings only)
 */
router.get('/:id', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findOne({
      where: {
        id,
        [Op.or]: [
          { guest_email: req.user!.email },
          { '$User.id$': req.user!.id }
        ]
      },
      include: [
        {
          model: Property,
          as: 'Property',
          attributes: ['id', 'name', 'location', 'city', 'country', 'images', 'check_in_time', 'check_out_time']
        },
        {
          model: Room,
          as: 'Room',
          attributes: ['id', 'name', 'type', 'description', 'amenities']
        },
        {
          model: User,
          as: 'User',
          required: false,
          attributes: []
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

/**
 * @route   POST /api/bookings/:id/cancel
 * @desc    Cancel a booking
 * @access  Private (own bookings only)
 */
router.post('/:id/cancel', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await Booking.findOne({
      where: {
        id,
        [Op.or]: [
          { guest_email: req.user!.email },
          { '$User.id$': req.user!.id }
        ]
      },
      include: [
        {
          model: User,
          as: 'User',
          required: false,
          attributes: []
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Check if booking can be cancelled
    if (booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already cancelled' });
    }

    if (booking.status === 'checked_out') {
      return res.status(400).json({ error: 'Cannot cancel completed booking' });
    }

    // Check cancellation policy (e.g., must be 24 hours before check-in)
    const checkInDate = new Date(booking.check_in);
    const now = new Date();
    const hoursUntilCheckIn = (checkInDate.getTime() - now.getTime()) / (1000 * 60 * 60);

    if (hoursUntilCheckIn < 24) {
      return res.status(400).json({ 
        error: 'Cancellation must be made at least 24 hours before check-in',
        hoursUntilCheckIn: Math.round(hoursUntilCheckIn)
      });
    }

    // Process refund if payment was made
    let refundInfo = null;
    if (booking.payment_intent_id && booking.payment_status === 'paid') {
      try {
        const refund = await stripeService.createRefund(booking.payment_intent_id);
        refundInfo = {
          refund_id: refund.id,
          amount: refund.amount / 100,
          status: refund.status
        };
        
        await booking.update({ payment_status: 'refunded' });
      } catch (refundError) {
        console.error('Refund error:', refundError);
        // Continue with cancellation even if refund fails
      }
    }

    // Update booking status
    await booking.update({
      status: 'cancelled',
      cancellation_reason: reason || 'User requested cancellation',
      cancelled_at: new Date()
    });

    // Log the cancellation
    await LoggingService.logAction({
      user_id: req.user!.id,
      action: 'cancel_booking',
      req,
      details: {
        booking_id: booking.id,
        reason,
        refund: refundInfo
      }
    });

    res.json({
      success: true,
      message: 'Booking cancelled successfully',
      data: {
        booking,
        refund: refundInfo
      }
    });
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

/**
 * @route   GET /api/bookings/:id/invoice
 * @desc    Generate and download booking invoice as PDF
 * @access  Private (own bookings only)
 */
router.get('/:id/invoice', authenticateToken, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const booking = await Booking.findOne({
      where: {
        id,
        [Op.or]: [
          { guest_email: req.user!.email },
          { '$User.id$': req.user!.id }
        ]
      },
      include: [
        {
          model: Property,
          as: 'Property',
          attributes: ['id', 'name', 'location', 'city', 'country', 'address']
        },
        {
          model: Room,
          as: 'Room',
          attributes: ['id', 'name', 'type']
        },
        {
          model: User,
          as: 'User',
          required: false,
          attributes: []
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    // Set response headers
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${booking.id}.pdf`);
    
    // Pipe PDF to response
    doc.pipe(res);

    // Header
    doc.fontSize(20).text('INVOICE', { align: 'center' });
    doc.moveDown();

    // Property Info
    doc.fontSize(12).text(`${(booking as any).Property?.name}`, { continued: false });
    doc.fontSize(10).text(`${(booking as any).Property?.address || (booking as any).Property?.location}`);
    doc.text(`${(booking as any).Property?.city}, ${(booking as any).Property?.country}`);
    doc.moveDown();

    // Invoice Details
    doc.fontSize(10);
    doc.text(`Invoice #: INV-${booking.id}`, { continued: false });
    doc.text(`Date: ${new Date().toLocaleDateString()}`);
    doc.text(`Booking ID: ${booking.id}`);
    doc.moveDown();

    // Guest Details
    doc.fontSize(12).text('Guest Information:', { underline: true });
    doc.fontSize(10);
    doc.text(`Name: ${booking.guest_name}`);
    doc.text(`Email: ${booking.guest_email}`);
    if (booking.guest_phone) doc.text(`Phone: ${booking.guest_phone}`);
    doc.moveDown();

    // Booking Details
    doc.fontSize(12).text('Booking Details:', { underline: true });
    doc.fontSize(10);
    doc.text(`Room: ${(booking as any).Room?.name || booking.room_type}`);
    doc.text(`Check-in: ${new Date(booking.check_in).toLocaleDateString()}`);
    doc.text(`Check-out: ${new Date(booking.check_out).toLocaleDateString()}`);
    doc.text(`Status: ${booking.status.toUpperCase()}`);
    doc.moveDown();

    // Payment Details
    doc.fontSize(12).text('Payment Information:', { underline: true });
    doc.fontSize(10);
    doc.text(`Total Amount: ${booking.total_amount} ${booking.currency}`);
    doc.text(`Payment Status: ${booking.payment_status?.toUpperCase() || 'N/A'}`);
    if (booking.payment_intent_id) {
      doc.text(`Payment ID: ${booking.payment_intent_id}`);
    }
    doc.moveDown(2);

    // Footer
    doc.fontSize(8).text('Thank you for your business!', { align: 'center' });
    doc.text('For questions, please contact support@secretworldhotels.com', { align: 'center' });

    // Finalize PDF
    doc.end();

    // Log the invoice generation
    await LoggingService.logAction({
      user_id: req.user!.id,
      action: 'generate_invoice',
      req,
      details: {
        booking_id: booking.id
      }
    });

  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).json({ error: 'Failed to generate invoice' });
  }
});

export default router;
