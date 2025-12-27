import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware';
import { logAction } from '../middleware/loggingMiddleware';
import { addPropertyFilter } from '../middleware/propertyAccess';
import { HotelService, Booking, Property, User } from '../models';
import { Op } from 'sequelize';
import staffRoomController from '../controllers/staffRoomController';
import staffBookingController from '../controllers/staffBookingController';

// Extender Request para incluir usuario autenticado
interface AuthRequest extends Request {
  user?: User & { property_id?: number | null; role?: string };
  propertyFilter?: { property_id?: number };
}

const router = Router();

// Apply property filter to all routes
router.use(addPropertyFilter);

// ==================== BOOKING MANAGEMENT ROUTES ====================

// Get all pending bookings (marketplace bookings awaiting approval)
router.get('/bookings/pending', 
  authenticateToken, 
  authorizeRole(['staff', 'admin']), 
  logAction('staff_view_pending_bookings'),
  (req: any, res: Response) => staffBookingController.getPendingBookings(req, res)
);

// Get booking statistics for dashboard
router.get('/bookings/stats',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_view_booking_stats'),
  (req: any, res: Response) => staffBookingController.getBookingStats(req, res)
);

// Get all bookings with optional filters
router.get('/bookings',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_view_bookings'),
  (req: any, res: Response) => staffBookingController.getAllBookings(req, res)
);

// Approve a pending booking
router.post('/bookings/:id/approve',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_approve_booking'),
  (req: any, res: Response) => staffBookingController.approveBooking(req, res)
);

// Reject a pending booking
router.post('/bookings/:id/reject',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_reject_booking'),
  (req: any, res: Response) => staffBookingController.rejectBooking(req, res)
);

// ==================== SERVICE MANAGEMENT ROUTES ====================

// List all service requests for staff's hotel (optionally filter by status)
router.get('/services', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_list_services'), async (req: AuthRequest, res: Response) => {
  try {
    const propertyFilter = req.propertyFilter || {};
    const { status } = req.query;

    // Find all bookings for this property
    const bookings = await Booking.findAll({ 
      where: propertyFilter,
      attributes: ['id']
    });
    const bookingIds = bookings.map(b => b.id);

    // Find all hotel services for these bookings
    const where: any = { booking_id: { [Op.in]: bookingIds } };
    if (status) where.status = status;

    const services = await HotelService.findAll({
      where,
      order: [['requested_at', 'DESC']]
    });

    res.json({ services });
  } catch (error) {
    console.error('Error listing hotel services for staff:', error);
    res.status(500).json({ error: 'Failed to list hotel services' });
  }
});

// Update status of a service request (accept, in_progress, completed, rejected)
router.patch('/services/:id/status', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_update_service_status'), async (req: AuthRequest, res: Response) => {
  try {
    const propertyFilter = req.propertyFilter || {};
    const { id } = req.params;
    const { status } = req.body;

    if (!['requested', 'confirmed', 'completed', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    // Find the service and check it belongs to staff's hotel
    const service = await HotelService.findByPk(id, {
      include: [{ 
        model: Booking, 
        as: 'Booking',
        where: propertyFilter
      }]
    }) as any;
    
    if (!service) {
      return res.status(404).json({ error: 'Service not found or not in your hotel' });
    }

    service.status = status;
    await service.save();
    res.json({ message: 'Service status updated', service });
  } catch (error) {
    console.error('Error updating service status:', error);
    res.status(500).json({ error: 'Failed to update service status' });
  }
});

// List service history for staff's hotel
router.get('/services/history', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_service_history'), async (req: AuthRequest, res: Response) => {
  try {
    const propertyFilter = req.propertyFilter || {};
    
    const bookings = await Booking.findAll({ 
      where: propertyFilter,
      attributes: ['id']
    });
    const bookingIds = bookings.map(b => b.id);
    
    const services = await HotelService.findAll({
      where: { booking_id: { [Op.in]: bookingIds } },
      order: [['requested_at', 'DESC']]
    });
    
    res.json({ services });
  } catch (error) {
    console.error('Error fetching service history:', error);
    res.status(500).json({ error: 'Failed to fetch service history' });
  }
});

// ============================================
// ROOM MANAGEMENT ENDPOINTS (Staff)
// ============================================

/**
 * Listar habitaciones del hotel del staff
 */
router.get('/rooms', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_list_rooms'), (req: AuthRequest, res: Response) => 
  staffRoomController.getRoomsByProperty(req, res)
);

/**
 * Crear nueva habitación
 */
router.post('/rooms', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_create_room'), (req: AuthRequest, res: Response) => 
  staffRoomController.createRoom(req, res)
);

/**
 * Actualizar habitación
 */
router.put('/rooms/:id', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_update_room'), (req: AuthRequest, res: Response) => 
  staffRoomController.updateRoom(req, res)
);

/**
 * Eliminar habitación
 */
router.delete('/rooms/:id', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_delete_room'), (req: AuthRequest, res: Response) => 
  staffRoomController.deleteRoom(req, res)
);

/**
 * Importar habitaciones desde PMS
 */
router.post('/rooms/import-from-pms', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_import_rooms_pms'), (req: AuthRequest, res: Response) => 
  staffRoomController.importFromPMS(req, res)
);

/**
 * Sincronizar habitaciones desde PMS (método simplificado)
 */
router.post('/rooms/sync', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_sync_rooms'), (req: AuthRequest, res: Response) => 
  staffRoomController.syncRooms(req, res)
);

/**
 * Activar/desactivar habitación en marketplace
 */
router.patch('/rooms/:id/marketplace', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_toggle_marketplace'), (req: AuthRequest, res: Response) => 
  staffRoomController.toggleMarketplace(req, res)
);

// Batch toggle all rooms marketplace status
router.post('/rooms/marketplace/batch', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_toggle_marketplace_batch'), (req: AuthRequest, res: Response) => 
  staffRoomController.toggleMarketplaceBatch(req, res)
);

// ==================== PRODUCTS/SERVICES ROUTES ====================

/**
 * Sincronizar productos/servicios desde PMS
 */
router.post('/products/sync', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_sync_products'), async (req: AuthRequest, res: Response) => {
  try {
    const propertyId = req.user?.property_id;
    
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'No property associated with user'
      });
    }

    const productSyncService = require('../services/productSyncService').default;
    const result = await productSyncService.syncProductsFromPMS(propertyId);

    res.json({
      success: result.success,
      data: result,
      message: result.summary || 'Sync completed'
    });
  } catch (error: any) {
    console.error('[StaffRoutes] Error syncing products:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to sync products'
    });
  }
});

/**
 * Obtener todos los servicios/productos activos
 */
router.get('/products', authenticateToken, authorizeRole(['staff', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const propertyId = req.user?.property_id;
    
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'No property associated with user'
      });
    }

    const productSyncService = require('../services/productSyncService').default;
    const services = await productSyncService.getActiveServices(propertyId);

    res.json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error: any) {
    console.error('[StaffRoutes] Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch products'
    });
  }
});

// ==================== MARKETPLACE CONFIGURATION ROUTES ====================

/**
 * Get marketplace configuration for staff's property
 */
router.get('/marketplace/config',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_view_marketplace_config'),
  async (req: AuthRequest, res: Response) => {
    try {
      const propertyId = req.user?.property_id;
      
      if (!propertyId) {
        return res.status(400).json({
          success: false,
          error: 'No property associated with user'
        });
      }

      const property = await Property.findByPk(propertyId, {
        attributes: [
          'id', 'name', 'description', 'amenities', 'images', 'stars',
          'is_marketplace_enabled', 'marketplace_description', 
          'marketplace_images', 'marketplace_amenities', 'marketplace_enabled_at',
          'city', 'country', 'check_in_time', 'check_out_time'
        ]
      });

      if (!property) {
        return res.status(404).json({
          success: false,
          error: 'Property not found'
        });
      }

      res.json({
        success: true,
        data: property
      });
    } catch (error: any) {
      console.error('Error fetching marketplace config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch marketplace configuration',
        message: error.message
      });
    }
  }
);

/**
 * Update marketplace configuration
 */
router.put('/marketplace/config',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_update_marketplace_config'),
  async (req: AuthRequest, res: Response) => {
    try {
      const propertyId = req.user?.property_id;
      const { 
        is_marketplace_enabled, 
        marketplace_description, 
        marketplace_images, 
        marketplace_amenities,
        city,
        country
      } = req.body;

      if (!propertyId) {
        return res.status(400).json({
          success: false,
          error: 'No property associated with user'
        });
      }

      const property = await Property.findByPk(propertyId);

      if (!property) {
        return res.status(404).json({
          success: false,
          error: 'Property not found'
        });
      }

      const updateData: any = {};
      
      if (typeof is_marketplace_enabled !== 'undefined') {
        updateData.is_marketplace_enabled = is_marketplace_enabled;
        if (is_marketplace_enabled && !property.marketplace_enabled_at) {
          updateData.marketplace_enabled_at = new Date();
        }
        // When enabling marketplace, automatically set property status to 'active'
        if (is_marketplace_enabled && property.status === 'pending_verification') {
          updateData.status = 'active';
        }
        // When disabling marketplace, optionally revert to pending_verification
        // (commented out - staff might want to keep property active for other reasons)
        // if (!is_marketplace_enabled && property.status === 'active') {
        //   updateData.status = 'pending_verification';
        // }
      }
      
      if (marketplace_description !== undefined) {
        updateData.marketplace_description = marketplace_description;
      }
      
      if (marketplace_images !== undefined) {
        updateData.marketplace_images = marketplace_images;
      }
      
      if (marketplace_amenities !== undefined) {
        updateData.marketplace_amenities = marketplace_amenities;
      }

      if (city !== undefined) {
        updateData.city = city;
      }

      if (country !== undefined) {
        updateData.country = country;
      }

      await property.update(updateData);

      res.json({
        success: true,
        message: 'Marketplace configuration updated successfully',
        data: property
      });
    } catch (error: any) {
      console.error('Error updating marketplace config:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update marketplace configuration',
        message: error.message
      });
    }
  }
);

export default router;
