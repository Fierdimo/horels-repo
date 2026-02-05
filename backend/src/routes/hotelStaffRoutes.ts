import { Router, Request, Response } from 'express';
import { authenticateToken, authorizeRole } from '../middleware/authMiddleware';
import { logAction } from '../middleware/loggingMiddleware';
import { addPropertyFilter } from '../middleware/propertyAccess';
import { HotelService, Property, User } from '../models';
import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';
import QRCode from 'qrcode';
import nodemailer from 'nodemailer';
import staffRoomController from '../controllers/staffRoomController';
import staffBookingController from '../controllers/staffBookingController';
import sequelize from '../config/database';

// V2 Models
import V2Booking from '../models/v2/V2Booking';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import WeekAllocation from '../models/v2/WeekAllocation';
import Ownership from '../models/v2/Ownership';

// V2 Services
import { OwnershipRegistrationService } from '../services/v2/OwnershipRegistrationService';

// Extender Request para incluir usuario autenticado
interface AuthRequest extends Request {
  user?: User & { property_id?: number | null; role?: string };
  propertyFilter?: { property_id?: number };
}

const router = Router();

/**
 * Get current week number from a date
 */
function getWeekNumber(date: Date): number {
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
  const pastDaysOfYear = (date.getTime() - firstDayOfYear.getTime()) / 86400000;
  return Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
}


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

// Check-in a confirmed booking
router.post('/bookings/:id/checkin',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_checkin_booking'),
  (req: any, res: Response) => staffBookingController.checkInBooking(req, res)
);

// Check-out a checked-in booking
router.post('/bookings/:id/checkout',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_checkout_booking'),
  (req: any, res: Response) => staffBookingController.checkOutBooking(req, res)
);

// ==================== SERVICE MANAGEMENT ROUTES ====================

// List all service requests for staff's hotel (optionally filter by status)
router.get('/services', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_list_services'), async (req: AuthRequest, res: Response) => {
  try {
    const propertyFilter = req.propertyFilter || {};
    const { status } = req.query;

    // Find all bookings for this property
    const bookings = await V2Booking.findAll({ 
      where: propertyFilter,
      attributes: ['id']
    });
    const bookingIds = bookings.map((b: any) => b.id);

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
        model: V2Booking, 
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
    
    const bookings = await V2Booking.findAll({ 
      where: propertyFilter,
      attributes: ['id']
    });
    const bookingIds = bookings.map((b: any) => b.id);
    
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
// INVENTORY MANAGEMENT ENDPOINTS (V2 - Timeshares)
// ============================================

/**
 * Get timeshare units inventory for staff's property
 */
router.get('/inventory/units', authenticateToken, authorizeRole(['staff', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const property_id = req.user?.property_id;
    const role = req.user?.role;

    // DEBUG LOG
    console.log('[inventory/units] User:', { id: req.user?.id, email: req.user?.email, role, property_id });

    // Admin can see all properties
    // Staff must be assigned to a property
    if (role !== 'admin' && !property_id) {
      console.log('[inventory/units] BLOCKED: Staff without property_id');
      return res.status(403).json({
        success: false,
        error: 'Staff user must be assigned to a property'
      });
    }

    // Build query - admin sees all, staff sees only their property
    const where: any = { is_active: true };
    if (role !== 'admin') {
      where.property_id = property_id;
    }

    const units = await TimeshareUnit.findAll({
      where,
      attributes: ['id', 'category', 'capacity_min', 'capacity_max', 'quantity', 'base_credit_value', 'description', 'property_id'],
      order: [['property_id', 'ASC'], ['category', 'ASC']]
    });

    res.json({
      success: true,
      data: units
    });
  } catch (error: any) {
    console.error('Error fetching units:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch timeshare units',
      message: error.message
    });
  }
});

/**
 * Get occupied weeks for a specific unit
 */
router.get('/inventory/units/:unitId/occupied-weeks', authenticateToken, authorizeRole(['staff', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const property_id = req.user?.property_id;
    const { unitId } = req.params;
    const year = parseInt(req.query.year as string) || new Date().getFullYear();

    if (!property_id) {
      return res.status(403).json({
        success: false,
        error: 'Staff user must be assigned to a property'
      });
    }

    // Verify unit belongs to staff's property
    const unit = await TimeshareUnit.findOne({
      where: { id: unitId, property_id }
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        error: 'Unit not found or does not belong to your property'
      });
    }

    // Get all ownerships for this unit
    const ownerships = await Ownership.findAll({
      where: { 
        unit_id: unitId,
        type: 'FIXED_WEEK',
        status: 'ACTIVE'
      },
      attributes: ['id', 'fixed_week_number', 'owner_id'],
      include: [{
        model: User,
        as: 'owner',
        attributes: ['first_name', 'last_name', 'email']
      }]
    });

    // Group by week number and count ownerships per week
    const weekMap = new Map<number, any[]>();
    
    ownerships.forEach((ownership: any) => {
      const weekNum = ownership.fixed_week_number;
      if (!weekMap.has(weekNum)) {
        weekMap.set(weekNum, []);
      }
      
      const ownerName = ownership.owner 
        ? `${ownership.owner.first_name} ${ownership.owner.last_name}`.trim()
        : null;
      
      weekMap.get(weekNum)!.push({
        owner_name: ownerName,
        owner_email: ownership.owner?.email
      });
    });

    // Format response: only mark as occupied if all units are taken
    const occupiedWeeks = Array.from(weekMap.entries()).map(([weekNumber, owners]) => ({
      week_number: weekNumber,
      owners: owners,
      count: owners.length,
      available: unit.quantity - owners.length, // Remaining units
      is_fully_occupied: owners.length >= unit.quantity
    }));

    res.json({
      success: true,
      data: occupiedWeeks,
      total_units: unit.quantity
    });
  } catch (error: any) {
    console.error('Error fetching occupied weeks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch occupied weeks',
      message: error.message
    });
  }
});

/**
 * Get week allocations inventory for staff's property
 */
router.get('/inventory/weeks', authenticateToken, authorizeRole(['staff', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const property_id = req.user?.property_id;
    const { year, status, unit_id } = req.query;

    if (!property_id) {
      return res.status(403).json({
        success: false,
        error: 'Staff user must be assigned to a property'
      });
    }

    // Get all units for this property
    const units = await TimeshareUnit.findAll({
      where: { property_id, is_active: true },
      attributes: ['id']
    });

    const unitIds = units.map((u: any) => u.id);

    // Get ownerships for these units
    const ownershipWhere: any = { unit_id: unitIds };
    const ownerships = await Ownership.findAll({
      where: ownershipWhere,
      attributes: ['id']
    });

    const ownershipIds = ownerships.map((o: any) => o.id);

    // Build week allocation filters
    const weekWhere: any = { ownership_id: ownershipIds };
    
    if (year) {
      weekWhere.year = parseInt(year as string);
    }
    
    if (status) {
      weekWhere.status = status;
    }

    if (unit_id) {
      const filteredOwnerships = await Ownership.findAll({
        where: { unit_id: parseInt(unit_id as string) },
        attributes: ['id']
      });
      weekWhere.ownership_id = filteredOwnerships.map((o: any) => o.id);
    }

    const weeks = await WeekAllocation.findAll({
      where: weekWhere,
      include: [
        {
          model: Ownership,
          as: 'ownership',
          attributes: ['id', 'type'],
          include: [
            {
              model: TimeshareUnit,
              as: 'unit',
              attributes: ['id', 'name', 'category']
            }
          ]
        }
      ],
      order: [['year', 'DESC'], ['week_number', 'ASC']],
      limit: 500
    });

    res.json({
      success: true,
      data: weeks,
      count: weeks.length
    });
  } catch (error: any) {
    console.error('Error fetching week allocations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch week allocations',
      message: error.message
    });
  }
});

/**
 * Get ownerships for staff's property
 */
router.get('/inventory/ownerships', authenticateToken, authorizeRole(['staff', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const property_id = req.user?.property_id;
    const { unit_id, status } = req.query;

    if (!property_id) {
      return res.status(403).json({
        success: false,
        error: 'Staff user must be assigned to a property'
      });
    }

    // Get units for this property
    const unitWhere: any = { property_id, is_active: true };
    if (unit_id) {
      unitWhere.id = parseInt(unit_id as string);
    }

    const units = await TimeshareUnit.findAll({
      where: unitWhere,
      attributes: ['id']
    });

    const unitIds = units.map((u: any) => u.id);

    // Get ownerships
    const ownershipWhere: any = { unit_id: unitIds };
    if (status) {
      ownershipWhere.status = status;
    }

    const ownerships = await Ownership.findAll({
      where: ownershipWhere,
      include: [
        {
          model: TimeshareUnit,
          as: 'unit',
          attributes: ['id', 'name', 'category']
        }
      ],
      order: [['created_at', 'DESC']],
      limit: 200
    });

    res.json({
      success: true,
      data: ownerships,
      count: ownerships.length
    });
  } catch (error: any) {
    console.error('Error fetching ownerships:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ownerships',
      message: error.message
    });
  }
});

// ============================================
// ROOM MANAGEMENT ENDPOINTS (Staff)
// ============================================

/**
 * Get dashboard statistics for staff (V2 - Timeshares)
 * Shows booking stats and week allocation inventory
 */
router.get('/dashboard/stats', authenticateToken, authorizeRole(['staff', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const property_id = req.user?.property_id;

    if (!property_id) {
      return res.status(403).json({
        success: false,
        error: 'Staff user must be assigned to a property. Please contact admin.'
      });
    }

    // Get bookings by status for this property
    const bookings = await V2Booking.findAll({ 
      where: { property_id },
      attributes: ['id', 'status']
    });

    const pendingBookings = bookings.filter(b => b.status === 'PENDING').length;
    const confirmedBookings = bookings.filter(b => b.status === 'CONFIRMED').length;
    const checkedInBookings = bookings.filter(b => b.status === 'CHECKED_IN').length;
    const checkedOutBookings = bookings.filter(b => b.status === 'CHECKED_OUT').length;

    // Get week allocations for this property
    const timeshareUnits = await TimeshareUnit.findAll({
      where: { property_id, is_active: true },
      attributes: ['id']
    });

    const unitIds = timeshareUnits.map((u: any) => u.id);

    const ownerships = await Ownership.findAll({
      where: { unit_id: unitIds },
      attributes: ['id']
    });

    const ownershipIds = ownerships.map((o: any) => o.id);

    const weekAllocations = await WeekAllocation.findAll({
      where: { ownership_id: ownershipIds },
      attributes: ['id', 'status']
    });

    const releasedWeeks = weekAllocations.filter(w => w.status === 'RELEASED').length;
    const bookedWeeks = weekAllocations.filter(w => w.status === 'BOOKED').length;
    const assignedWeeks = weekAllocations.filter(w => w.status === 'ASSIGNED').length;

    res.json({
      success: true,
      data: {
        bookings: {
          pending: pendingBookings,
          confirmed: confirmedBookings,
          checkedIn: checkedInBookings,
          checkedOut: checkedOutBookings,
          total: bookings.length
        },
        weeks: {
          available: releasedWeeks,
          booked: bookedWeeks,
          assigned: assignedWeeks,
          total: weekAllocations.length
        },
        property: {
          id: property_id,
          totalUnits: timeshareUnits.length,
          totalOwnerships: ownerships.length
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch dashboard statistics',
      message: error.message 
    });
  }
});

/**
 * Get all properties (for staff to create invitations with multiple properties)
 */
router.get('/properties', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_list_properties'), async (req: AuthRequest, res: Response) => {
  try {
    const properties = await Property.findAll({
      attributes: ['id', 'name', 'city', 'country', 'region'],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: properties
    });
  } catch (error: any) {
    console.error('Error fetching properties:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch properties',
      message: error.message 
    });
  }
});

/**
 * Listar habitaciones del hotel del staff
 * DEPRECATED: V2 uses timeshare units, not rooms
 */
router.get('/rooms', authenticateToken, authorizeRole(['staff', 'admin']), logAction('staff_list_rooms'), (req: AuthRequest, res: Response) => {
  // V2: Return empty array since we don't use rooms in timeshare model
  res.json({ success: true, data: [], message: 'V2: Rooms not applicable for timeshares' });
});

/**
 * Get season for specific date (for credit estimation in invitations)
 */
router.get('/seasonal-calendar/:propertyId/season', authenticateToken, authorizeRole(['staff', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const propertyId = parseInt(req.params.propertyId);
    const date = req.query.date ? new Date(req.query.date as string) : new Date();
    
    if (isNaN(propertyId)) {
      return res.status(400).json({ success: false, error: 'Invalid propertyId' });
    }

    const SeasonalCalendar = (await import('../models/SeasonalCalendar')).default;
    const season = await SeasonalCalendar.getSeasonForDateWithDefault(propertyId, date);
    
    res.json({
      success: true,
      data: {
        season: season,
        date: date.toISOString().split('T')[0]
      }
    });
  } catch (error: any) {
    console.error('Error getting season for date:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Estimate credits for room assignment (for invitations)
 */
router.post('/estimate-credits', authenticateToken, authorizeRole(['staff', 'admin']), async (req: AuthRequest, res: Response) => {
  try {
    const { propertyId, roomType, seasonType, nights } = req.body;

    if (!propertyId || !roomType || !seasonType) {
      return res.status(400).json({ 
        success: false, 
        error: 'propertyId, roomType, and seasonType are required' 
      });
    }

    if (!['RED', 'WHITE', 'BLUE'].includes(seasonType)) {
      return res.status(400).json({ 
        success: false, 
        error: 'seasonType must be RED, WHITE, or BLUE' 
      });
    }

    const CreditCalculationService = (await import('../services/CreditCalculationService')).default;
    
    // If nights provided, calculate booking cost; otherwise calculate deposit value
    if (nights && nights > 0) {
      const bookingCost = await CreditCalculationService.calculateBookingCost(
        parseInt(propertyId),
        roomType,
        seasonType as 'RED' | 'WHITE' | 'BLUE',
        parseInt(nights)
      );

      res.json({
        success: true,
        data: {
          estimatedCredits: bookingCost.totalCredits,
          nights: nights,
          creditsPerNight: bookingCost.creditsPerNight,
          seasonType: seasonType,
          breakdown: bookingCost.breakdown
        }
      });
    } else {
      // For deposit calculation (week value)
      const estimate = await CreditCalculationService.estimateCreditsForWeek(
        parseInt(propertyId),
        roomType,
        seasonType as 'RED' | 'WHITE' | 'BLUE'
      );

      res.json({
        success: true,
        data: {
          estimatedCredits: estimate.estimatedCredits,
          seasonType: estimate.seasonType,
          breakdown: estimate.breakdown
        }
      });
    }

  } catch (error: any) {
    console.error('Error estimating credits:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to estimate credits'
    });
  }
});

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
    
    // V2: property_id doesn't exist on users, this endpoint is V1-only
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'This endpoint requires property assignment (V1 feature not available in V2)'
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
    
    // V2: property_id doesn't exist on users, this endpoint is V1-only
    if (!propertyId) {
      return res.status(400).json({
        success: false,
        error: 'This endpoint requires property assignment (V1 feature not available in V2)'
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
      
      // V2: property_id doesn't exist on users, this endpoint is V1-only
      if (!propertyId) {
        return res.status(400).json({
          success: false,
          error: 'This endpoint requires property assignment (V1 feature not available in V2)'
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
        // When enabling marketplace, automatically set property to active
        if (is_marketplace_enabled && !property.is_active) {
          updateData.is_active = true;
        }
        // When disabling marketplace, keep property active
        // (commented out - staff might want to keep property active for other reasons)
        // if (!is_marketplace_enabled && property.is_active) {
        //   updateData.is_active = false;
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

// ==================== OWNERSHIP REGISTRATION ROUTES ====================

/**
 * Check email status - Para validación en tiempo real
 */
router.get('/users/check-email', 
  authenticateToken, 
  authorizeRole(['staff', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { email } = req.query;

      if (!email || typeof email !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'Email parameter is required'
        });
      }

      const registrationService = new OwnershipRegistrationService();
      const status = await registrationService.checkEmailStatus(email);

      res.json({
        success: true,
        data: status
      });
    } catch (error: any) {
      console.error('Error checking email:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to check email status',
        message: error.message
      });
    }
  }
);

/**
 * Register new ownership - Maneja 3 escenarios automáticamente:
 * 1. Usuario nuevo: Crea usuario + ownership
 * 2. Guest → Owner: Convierte role + crea ownership
 * 3. Owner adicional: Solo crea ownership adicional
 */
router.post('/ownerships/register',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  logAction('staff_register_ownership'),
  async (req: AuthRequest, res: Response) => {
    const transaction = await sequelize.transaction();
    
    try {
      const property_id = req.user?.property_id;

      if (!property_id) {
        await transaction.rollback();
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property'
        });
      }

      const {
        owner_email,
        owner_first_name,
        owner_last_name,
        owner_phone,
        unit_id,
        type,
        fixed_week_number,
        purchase_date,
        contract_start_year,
        contract_end_year,
        notes
      } = req.body;

      // Validaciones básicas - Solo campos esenciales
      if (!owner_email || !unit_id || !fixed_week_number || !contract_start_year) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: owner_email, unit_id, fixed_week_number, contract_start_year'
        });
      }

      // Validar que la semana no esté en el pasado
      const currentYear = new Date().getFullYear();
      const currentWeek = getWeekNumber(new Date());
      const weekNum = parseInt(fixed_week_number);
      const yearNum = parseInt(contract_start_year);

      if (yearNum < currentYear || (yearNum === currentYear && weekNum < currentWeek)) {
        await transaction.rollback();
        return res.status(400).json({
          success: false,
          error: `Cannot register week ${weekNum} of year ${yearNum} - it's in the past. Current week is ${currentWeek} of ${currentYear}.`
        });
      }

      const registrationService = new OwnershipRegistrationService();
      
      const result = await registrationService.registerOwnership({
        owner_email,
        owner_first_name,
        owner_last_name,
        owner_phone,
        unit_id: parseInt(unit_id),
        type: 'FIXED_WEEK', // Solo permitimos FIXED_WEEK
        fixed_week_number: parseInt(fixed_week_number),
        annual_fee: 0, // Valor por defecto
        currency: 'EUR', // Valor por defecto
        contract_reference: '', // Se generará automáticamente
        purchase_date,
        contract_start_year: parseInt(contract_start_year),
        contract_end_year: contract_end_year ? parseInt(contract_end_year) : undefined,
        notes
      }, property_id, transaction);

      await transaction.commit();

      res.json(result);
    } catch (error: any) {
      await transaction.rollback();
      console.error('Error registering ownership:', error);
      
      res.status(400).json({
        success: false,
        error: error.message || 'Failed to register ownership'
      });
    }
  }
);

/**
 * Generate invitation link for owner
 */
router.post('/ownerships/:ownershipId/generate-invitation',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ownershipId } = req.params;
      const property_id = req.user?.property_id;

      if (!property_id) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property'
        });
      }

      // Get ownership with user info
      const ownership = await Ownership.findOne({
        where: { id: ownershipId },
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'email', 'first_name', 'last_name']
          },
          {
            model: TimeshareUnit,
            as: 'unit',
            attributes: ['id', 'category', 'bedrooms', 'bathrooms'],
            include: [{
              model: TimeshareProperty,
              as: 'property',
              attributes: ['id', 'name']
            }]
          }
        ]
      });

      if (!ownership) {
        return res.status(404).json({
          success: false,
          error: 'Ownership not found'
        });
      }

      const owner = (ownership as any).owner;
      const unit = (ownership as any).unit;

      // Generate invitation token (simple JWT with ownership info)
      const invitationToken = jwt.sign(
        {
          ownershipId: ownership.id,
          userId: owner.id,
          email: owner.email,
          type: 'ownership_invitation'
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '30d' }
      );

      // Generate invitation link
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const invitationLink = `${frontendUrl}/owner/welcome?token=${invitationToken}`;

      res.json({
        success: true,
        data: {
          invitationToken,
          invitationLink,
          owner: {
            email: owner.email,
            name: `${owner.first_name} ${owner.last_name}`
          },
          ownership: {
            id: ownership.id,
            unit: unit.category,
            property: unit.property.name
          }
        }
      });
    } catch (error: any) {
      console.error('Error generating invitation:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate invitation',
        message: error.message
      });
    }
  }
);

/**
 * Send invitation email with link and QR code
 */
router.post('/ownerships/:ownershipId/send-invitation-email',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ownershipId } = req.params;
      const property_id = req.user?.property_id;

      if (!property_id) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property'
        });
      }

      // Get ownership with user info
      const ownership = await Ownership.findOne({
        where: { id: ownershipId },
        include: [
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'email', 'first_name', 'last_name']
          },
          {
            model: TimeshareUnit,
            as: 'unit',
            attributes: ['id', 'category', 'bedrooms', 'bathrooms'],
            include: [{
              model: TimeshareProperty,
              as: 'property',
              attributes: ['id', 'name']
            }]
          }
        ]
      });

      if (!ownership) {
        return res.status(404).json({
          success: false,
          error: 'Ownership not found'
        });
      }

      const owner = (ownership as any).owner;
      const unit = (ownership as any).unit;

      // Generate invitation token
      const invitationToken = jwt.sign(
        {
          ownershipId: ownership.id,
          userId: owner.id,
          email: owner.email,
          type: 'ownership_invitation'
        },
        process.env.JWT_SECRET || 'your-secret-key',
        { expiresIn: '30d' }
      );

      // Generate invitation link
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const invitationLink = `${frontendUrl}/owner/welcome?token=${invitationToken}`;

      // Generate QR code as base64
      const qrCodeDataUrl = await QRCode.toDataURL(invitationLink, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });

      // Configure email transporter
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587'),
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD
        }
      });

      // Email HTML content
      const emailHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
            .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
            .qr-section { background: white; padding: 20px; margin: 20px 0; text-align: center; border-radius: 8px; border: 2px solid #667eea; }
            .button { display: inline-block; background: #667eea; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; margin: 20px 0; font-weight: bold; }
            .link-box { background: white; padding: 15px; margin: 20px 0; border-radius: 8px; border: 1px solid #ddd; word-break: break-all; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>¡Bienvenido a ${unit.property.name}!</h1>
              <p>Tu timeshare ha sido registrado exitosamente</p>
            </div>
            <div class="content">
              <h2>Hola ${owner.first_name},</h2>
              <p>Te damos la bienvenida como propietario de timeshare en <strong>${unit.property.name}</strong>.</p>
              
              <p><strong>Detalles de tu propiedad:</strong></p>
              <ul>
                <li>Unidad: ${unit.category}</li>
                <li>Habitaciones: ${unit.bedrooms}</li>
                <li>Baños: ${unit.bathrooms}</li>
              </ul>

              <h3>Accede a tu cuenta de dos formas:</h3>
              
              <div style="margin: 20px 0;">
                <h4>1. Escanea este código QR:</h4>
                <div class="qr-section">
                  <img src="${qrCodeDataUrl}" alt="QR Code" style="max-width: 250px;" />
                  <p style="margin-top: 10px; color: #666; font-size: 14px;">Escanea con la cámara de tu teléfono</p>
                </div>
              </div>

              <div style="margin: 20px 0;">
                <h4>2. O haz clic en este botón:</h4>
                <div style="text-align: center;">
                  <a href="${invitationLink}" class="button">Acceder a mi cuenta</a>
                </div>
              </div>

              <div style="margin: 20px 0;">
                <p style="font-size: 14px; color: #666;">Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
                <div class="link-box">
                  <a href="${invitationLink}" style="color: #667eea;">${invitationLink}</a>
                </div>
              </div>

              <p style="margin-top: 30px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
              <p>¡Disfruta tu timeshare!</p>
            </div>
            <div class="footer">
              <p>© ${new Date().getFullYear()} ${unit.property.name}. Todos los derechos reservados.</p>
              <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Send email
      await transporter.sendMail({
        from: process.env.SMTP_FROM || 'noreply@timeshare.com',
        to: owner.email,
        subject: `Bienvenido a ${unit.property.name} - Acceso a tu cuenta`,
        html: emailHtml
      });

      res.json({
        success: true,
        message: 'Email de invitación enviado exitosamente',
        data: {
          email: owner.email,
          invitationLink
        }
      });
    } catch (error: any) {
      console.error('Error sending invitation email:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to send invitation email',
        message: error.message
      });
    }
  }
);

/**
 * Get ownerships for staff's property
 */
router.get('/ownerships',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const property_id = req.user?.property_id;
      const userRole = req.user?.role;
      const { page = '1', limit = '10', status, search } = req.query;

      // Staff users MUST have a property assigned
      // Admin users can see all properties
      if (userRole === 'staff' && !property_id) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property'
        });
      }

      // Parse pagination params
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const offset = (pageNum - 1) * limitNum;

      // Get units - for staff: only their property, for admin: all properties
      const unitWhere: any = { is_active: true };
      if (userRole === 'staff' && property_id) {
        unitWhere.property_id = property_id;
      }
      
      const units = await TimeshareUnit.findAll({
        where: unitWhere,
        attributes: ['id', 'category']
      });

      const unitIds = units.map((u: any) => u.id);

      // Build where clause for ownerships
      const ownershipWhere: any = { unit_id: unitIds };

      // Status filter
      if (status && status !== 'ALL') {
        ownershipWhere.status = status;
      }

      // Search filter - will be applied in include for owner name/email
      const ownerWhere: any = {};
      const unitSearchWhere: any = {};
      
      if (search) {
        const searchTerm = search as string;
        // Search in multiple fields
        ownerWhere[Op.or] = [
          { email: { [Op.like]: `%${searchTerm}%` } },
          { first_name: { [Op.like]: `%${searchTerm}%` } },
          { last_name: { [Op.like]: `%${searchTerm}%` } },
          sequelize.where(
            sequelize.fn('CONCAT', sequelize.col('owner.first_name'), ' ', sequelize.col('owner.last_name')),
            { [Op.like]: `%${searchTerm}%` }
          )
        ];
        
        unitSearchWhere.category = { [Op.like]: `%${searchTerm}%` };
        ownershipWhere.contract_reference = { [Op.like]: `%${searchTerm}%` };
      }

      // Get total count first (for pagination)
      const totalCount = await Ownership.count({
        where: ownershipWhere,
        include: [
          {
            model: User,
            as: 'owner',
            where: Object.keys(ownerWhere).length > 0 ? ownerWhere : undefined,
            attributes: []
          },
          {
            model: TimeshareUnit,
            as: 'unit',
            where: Object.keys(unitSearchWhere).length > 0 ? unitSearchWhere : undefined,
            attributes: []
          }
        ],
        distinct: true
      });

      // Get paginated ownerships
      const ownerships = await Ownership.findAll({
        where: ownershipWhere,
        attributes: ['id', 'unit_id', 'owner_id', 'contract_reference', 'purchase_date', 'status', 'created_at', 'updated_at', 'type', 'fixed_week_number', 'contract_start_year'],
        include: [
          {
            model: TimeshareUnit,
            as: 'unit',
            attributes: ['id', 'category', 'bedrooms', 'bathrooms', 'base_credit_value'],
            where: Object.keys(unitSearchWhere).length > 0 ? unitSearchWhere : undefined
          },
          {
            model: User,
            as: 'owner',
            attributes: ['id', 'email', 'first_name', 'last_name', 'phone'],
            where: Object.keys(ownerWhere).length > 0 ? ownerWhere : undefined
          },
          {
            model: WeekAllocation,
            as: 'weekAllocations',
            attributes: ['id', 'week_number', 'year', 'start_date', 'end_date', 'status'],
            required: false,
            order: [['year', 'DESC'], ['week_number', 'DESC']],
            limit: 1
          }
        ],
        order: [['created_at', 'DESC']],
        limit: limitNum,
        offset: offset
      });

      // Calculate status counts for all ownerships (not just current page)
      const allOwnershipsForCounts = await Ownership.findAll({
        where: { unit_id: unitIds },
        attributes: ['id', 'status'],
        include: [
          {
            model: WeekAllocation,
            as: 'weekAllocations',
            attributes: ['id', 'status', 'start_date', 'end_date'],
            required: false,
            order: [['year', 'DESC'], ['week_number', 'DESC']],
            limit: 1
          }
        ]
      });

      // Helper function to get display status
      const getDisplayStatus = (ownership: any): string => {
        if (ownership.status === 'CANCELLED') return 'CANCELLED';
        if (ownership.status === 'CONVERTED_TO_CREDITS') return 'CONVERTED_TO_CREDITS';
        
        const currentWeek = ownership.weekAllocations?.[0];
        if (currentWeek) {
          const now = new Date();
          const startDate = new Date(currentWeek.start_date);
          const endDate = new Date(currentWeek.end_date);
          
          if (currentWeek.status === 'RELEASED') return 'CONVERTED_TO_CREDITS';
          if (now >= startDate && now <= endDate) return 'IN_USE';
          if (now > endDate) return 'USED';
          if (currentWeek.status === 'ASSIGNED') return 'ACTIVE';
        }
        
        return ownership.status;
      };

      // Count by status
      const statusCounts: any = {
        TOTAL: allOwnershipsForCounts.length,
        ACTIVE: 0,
        IN_USE: 0,
        USED: 0,
        CONVERTED_TO_CREDITS: 0,
        CANCELLED: 0
      };

      allOwnershipsForCounts.forEach((ownership: any) => {
        const displayStatus = getDisplayStatus(ownership);
        statusCounts[displayStatus] = (statusCounts[displayStatus] || 0) + 1;
      });

      res.json({
        success: true,
        data: ownerships,
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: totalCount,
          totalPages: Math.ceil(totalCount / limitNum)
        },
        statusCounts
      });
    } catch (error: any) {
      console.error('Error fetching ownerships:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to fetch ownerships',
        message: error.message
      });
    }
  }
);

// Cancel ownership (only if not converted to credits and date hasn't passed)
router.patch(
  '/ownerships/:ownershipId/cancel',
  authenticateToken,
  authorizeRole(['staff', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { ownershipId } = req.params;
      const property_id = req.user?.property_id;

      if (!property_id) {
        return res.status(403).json({
          success: false,
          error: 'Staff user must be assigned to a property'
        });
      }

      // Find ownership with unit and weeks
      const ownership = await Ownership.findOne({
        where: { id: ownershipId },
        include: [
          {
            model: TimeshareUnit,
            as: 'unit',
            where: { property_id }
          },
          {
            model: WeekAllocation,
            as: 'weekAllocations',
            attributes: ['id', 'start_date', 'status']
          }
        ]
      });

      if (!ownership) {
        return res.status(404).json({
          success: false,
          error: 'Ownership not found'
        });
      }

      // Check if already converted to credits
      if (ownership.status === 'CONVERTED_TO_CREDITS') {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel ownership that has been converted to credits'
        });
      }

      // Check if already cancelled
      if (ownership.status === 'CANCELLED') {
        return res.status(400).json({
          success: false,
          error: 'Ownership is already cancelled'
        });
      }

      // Check if any week has started (date has passed)
      const weeks = ownership.weekAllocations || [];
      const now = new Date();
      const hasStartedWeek = weeks.some((week: any) => {
        const startDate = new Date(week.start_date);
        return startDate <= now;
      });

      if (hasStartedWeek) {
        return res.status(400).json({
          success: false,
          error: 'Cannot cancel ownership - the period has already started'
        });
      }

      // Update ownership status to cancelled
      await ownership.update({ status: 'CANCELLED' });

      res.json({
        success: true,
        message: 'Ownership cancelled successfully',
        data: ownership
      });
    } catch (error: any) {
      console.error('Error cancelling ownership:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to cancel ownership',
        message: error.message
      });
    }
  }
);

export default router;
