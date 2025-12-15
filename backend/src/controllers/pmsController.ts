import { Request, Response } from 'express';
import PMSService from '../services/pmsService';

class PMSController {
  private pmsService: PMSService;

  constructor() {
    this.pmsService = new PMSService();
  }

  /**
   * Get room availability
   */
  async getAvailability(req: Request, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;
      const { startDate, endDate } = req.query as { startDate: string; endDate: string };

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required query parameters'
        });
        return;
      }

      const availability = await this.pmsService.getAvailability(propertyId, startDate, endDate);

      res.json({
        success: true,
        data: availability,
        count: availability.length
      });
    } catch (error: any) {
      console.error('Controller - Get availability error:', error);

      if (error.message.includes('Invalid date range')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve availability'
      });
    }
  }

  /**
   * Create a new booking
   */
  async createBooking(req: Request, res: Response): Promise<void> {
    try {
      const bookingData = req.body;

      // Validate required fields
      const requiredFields = ['propertyId', 'roomId', 'guestName', 'guestEmail', 'checkIn', 'checkOut', 'adults', 'totalAmount', 'currency'];
      const missingFields = requiredFields.filter(field => !bookingData[field]);

      if (missingFields.length > 0) {
        res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
        return;
      }

      // Verificar que la property tenga al menos un staff activo
      const { User, Role } = await import('../models');
      const activeStaff = await User.findOne({
        where: {
          property_id: bookingData.propertyId,
          status: 'approved'
        },
        include: [{
          model: Role,
          where: { name: 'staff' },
          required: true
        }]
      });

      if (!activeStaff) {
        res.status(400).json({
          success: false,
          error: 'Property is not available for bookings (no active staff)'
        });
        return;
      }

      const booking = await this.pmsService.createBooking(bookingData);

      res.status(201).json({
        success: true,
        data: booking,
        message: 'Booking created successfully'
      });
    } catch (error: any) {
      console.error('Controller - Create booking error:', error);

      if (error.message.includes('Missing required field') ||
          error.message.includes('Check-out date must be after') ||
          error.message.includes('Validation error')) {
        res.status(400).json({
          success: false,
          error: error.message
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to create booking'
      });
    }
  }

  /**
   * Get booking details
   */
  async getBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;

      if (!bookingId) {
        res.status(400).json({
          success: false,
          error: 'Booking ID is required'
        });
        return;
      }

      const booking = await this.pmsService.getBooking(bookingId);

      res.json({
        success: true,
        data: booking
      });
    } catch (error: any) {
      console.error('Controller - Get booking error:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve booking'
      });
    }
  }

  /**
   * Update booking
   */
  async updateBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;
      const updateData = req.body;

      if (!bookingId) {
        res.status(400).json({
          success: false,
          error: 'Booking ID is required'
        });
        return;
      }

      if (Object.keys(updateData).length === 0) {
        res.status(400).json({
          success: false,
          error: 'No update data provided'
        });
        return;
      }

      const booking = await this.pmsService.updateBooking(bookingId, updateData);

      res.json({
        success: true,
        data: booking,
        message: 'Booking updated successfully'
      });
    } catch (error: any) {
      console.error('Controller - Update booking error:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to update booking'
      });
    }
  }

  /**
   * Cancel booking
   */
  async cancelBooking(req: Request, res: Response): Promise<void> {
    try {
      const { bookingId } = req.params;

      if (!bookingId) {
        res.status(400).json({
          success: false,
          error: 'Booking ID is required'
        });
        return;
      }

      const result = await this.pmsService.cancelBooking(bookingId);

      res.json({
        success: true,
        data: result,
        message: 'Booking cancelled successfully'
      });
    } catch (error: any) {
      console.error('Controller - Cancel booking error:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Booking not found'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to cancel booking'
      });
    }
  }

  /**
   * Get property information
   */
  async getProperty(req: Request, res: Response): Promise<void> {
    try {
      const { propertyId } = req.params;

      if (!propertyId) {
        res.status(400).json({
          success: false,
          error: 'Property ID is required'
        });
        return;
      }

      const property = await this.pmsService.getProperty(propertyId);

      res.json({
        success: true,
        data: property
      });
    } catch (error: any) {
      console.error('Controller - Get property error:', error);

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Property not found'
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve property'
      });
    }
  }

  /**
   * Get user's properties
   */
  async getUserProperties(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'User authentication required'
        });
        return;
      }

      const properties = await this.pmsService.getUserProperties(userId);

      res.json({
        success: true,
        data: properties,
        count: properties.length
      });
    } catch (error: any) {
      console.error('Controller - Get user properties error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve properties'
      });
    }
  }
}

export default PMSController;