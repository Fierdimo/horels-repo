/**
 * Mock PMS Routes
 * 
 * API endpoints to manage and interact with the Mock PMS system.
 * Useful for development, testing, and demonstrations.
 */

import { Router, Request, Response } from 'express';
import { MockPMSManager } from '../services/pms/MockPMSService';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorize } from '../middleware/authorizationMiddleware';

const router = Router();
const mockPMSManager = new MockPMSManager();

/**
 * GET /api/mock-pms/properties
 * Get all mock properties
 */
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const properties = mockPMSManager.getAllProperties();
    
    res.json({
      success: true,
      count: properties.length,
      data: properties
    });
  } catch (error) {
    console.error('Error fetching mock properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mock properties'
    });
  }
});

/**
 * GET /api/mock-pms/properties/:propertyId
 * Get a specific mock property with its room types
 */
router.get('/properties/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    
    const property = mockPMSManager.getProperty(propertyId);
    
    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }
    
    const roomTypes = mockPMSManager.getRoomTypes(propertyId);
    
    res.json({
      success: true,
      data: {
        ...property,
        roomTypes
      }
    });
  } catch (error) {
    console.error('Error fetching mock property:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mock property'
    });
  }
});

/**
 * GET /api/mock-pms/properties/:propertyId/rooms
 * Get room types for a specific property
 */
router.get('/properties/:propertyId/rooms', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    
    const property = mockPMSManager.getProperty(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }
    
    const roomTypes = mockPMSManager.getRoomTypes(propertyId);
    
    res.json({
      success: true,
      count: roomTypes.length,
      data: roomTypes
    });
  } catch (error) {
    console.error('Error fetching room types:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch room types'
    });
  }
});

/**
 * GET /api/mock-pms/bookings
 * Get all mock bookings (optionally filtered by property)
 */
router.get('/bookings', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.query;
    
    let bookings;
    if (propertyId) {
      bookings = mockPMSManager.getPropertyBookings(propertyId as string);
    } else {
      bookings = mockPMSManager.getAllBookings();
    }
    
    res.json({
      success: true,
      count: bookings.length,
      data: bookings
    });
  } catch (error) {
    console.error('Error fetching mock bookings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mock bookings'
    });
  }
});

/**
 * GET /api/mock-pms/bookings/:bookingId
 * Get a specific mock booking
 */
router.get('/bookings/:bookingId', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { bookingId } = req.params;
    
    const booking = mockPMSManager.getBooking(bookingId);
    
    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found'
      });
    }
    
    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching mock booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch mock booking'
    });
  }
});

/**
 * GET /api/mock-pms/stats
 * Get Mock PMS statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = mockPMSManager.getStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error fetching mock PMS stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch statistics'
    });
  }
});

/**
 * DELETE /api/mock-pms/bookings
 * Clear all mock bookings (admin only, for testing)
 */
router.delete('/bookings', 
  authenticateToken, 
  authorize(['manage_settings']), 
  async (req: Request, res: Response) => {
    try {
      mockPMSManager.clearAllBookings();
      
      res.json({
        success: true,
        message: 'All mock bookings cleared'
      });
    } catch (error) {
      console.error('Error clearing mock bookings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear mock bookings'
      });
    }
  }
);

export default router;
