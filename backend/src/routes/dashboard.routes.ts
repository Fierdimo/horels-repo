import { Router, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { addPropertyFilter } from '../middleware/propertyAccess';
import { logAction } from '../middleware/loggingMiddleware';
import { Booking, Week, SwapRequest, HotelService, NightCredit } from '../models';
import { Op } from 'sequelize';
import sequelize from '../config/database';

const router = Router();

// All routes require authentication and property filtering
router.use(authenticateToken);
router.use(addPropertyFilter);

/**
 * @route   GET /api/dashboard/stats
 * @desc    Get dashboard statistics
 * @access  Private (hotel-staff sees their property, admin sees all)
 */
router.get('/stats', logAction('view_dashboard_stats'), async (req: any, res: Response) => {
  try {
    const propertyFilter = req.propertyFilter || {};
    const { start_date, end_date } = req.query;

    // Date range filter
    const dateFilter: any = {};
    if (start_date || end_date) {
      dateFilter.created_at = {};
      if (start_date) dateFilter.created_at[Op.gte] = new Date(start_date as string);
      if (end_date) dateFilter.created_at[Op.lte] = new Date(end_date as string);
    }

    // Get statistics
    const [
      totalBookings,
      activeBookings,
      totalWeeks,
      availableWeeks,
      pendingSwaps,
      completedServices
    ] = await Promise.all([
      Booking.count({ where: { ...propertyFilter, ...dateFilter } }),
      Booking.count({ where: { ...propertyFilter, status: 'confirmed', ...dateFilter } }),
      Week.count({ where: propertyFilter }),
      Week.count({ where: { ...propertyFilter, status: 'available' } }),
      SwapRequest.count({ where: { status: 'pending' } }), // Swaps aren't property-specific
      HotelService.count({ 
        where: { status: 'completed' },
        include: [{
          model: Booking,
          as: 'Booking',
          where: propertyFilter,
          attributes: []
        }]
      })
    ]);

    // Get night credits separately
    const nightCredits = await NightCredit.findAll({
      attributes: [[sequelize.fn('SUM', sequelize.col('remaining_nights')), 'total']],
      include: [{
        model: Week,
        as: 'OriginalWeek',
        where: propertyFilter,
        attributes: []
      }],
      raw: true
    });
    const totalNightCredits = (nightCredits[0] as any)?.total || 0;

    res.json({
      success: true,
      data: {
        bookings: {
          total: totalBookings,
          active: activeBookings
        },
        weeks: {
          total: totalWeeks,
          available: availableWeeks
        },
        swaps: {
          pending: pendingSwaps
        },
        services: {
          completed: completedServices
        },
        credits: {
          total: totalNightCredits
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
 * @route   GET /api/dashboard/bookings
 * @desc    Get recent bookings
 * @access  Private (hotel-staff sees their property, admin sees all)
 */
router.get('/bookings', logAction('view_dashboard_bookings'), async (req: any, res: Response) => {
  try {
    const propertyFilter = req.propertyFilter || {};
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    const where: any = { ...propertyFilter };
    if (status) where.status = status;

    const bookings = await Booking.findAll({
      where,
      limit,
      order: [['created_at', 'DESC']],
      include: [
        {
          association: 'Property',
          attributes: ['id', 'name', 'location']
        }
      ]
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
});

/**
 * @route   GET /api/dashboard/weeks
 * @desc    Get weeks for property
 * @access  Private (hotel-staff sees their property, admin sees all)
 */
router.get('/weeks', logAction('view_dashboard_weeks'), async (req: any, res: Response) => {
  try {
    const propertyFilter = req.propertyFilter || {};
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    const where: any = { ...propertyFilter };
    if (status) where.status = status;

    const weeks = await Week.findAll({
      where,
      limit,
      order: [
        [sequelize.fn('COALESCE', sequelize.col('start_date'), sequelize.col('created_at')), 'ASC']
      ],
      include: [
        {
          association: 'Property',
          attributes: ['id', 'name', 'location']
        },
        {
          association: 'Owner',
          attributes: ['id', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: weeks,
      count: weeks.length
    });
  } catch (error: any) {
    console.error('Error fetching weeks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weeks',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/dashboard/services
 * @desc    Get hotel services (filtered by property)
 * @access  Private (hotel-staff sees their property, admin sees all)
 */
router.get('/services', logAction('view_dashboard_services'), async (req: any, res: Response) => {
  try {
    const propertyFilter = req.propertyFilter || {};
    const limit = parseInt(req.query.limit as string) || 10;
    const status = req.query.status as string;

    // First get bookings for the property
    const bookings = await Booking.findAll({
      where: propertyFilter,
      attributes: ['id']
    });
    const bookingIds = bookings.map(b => b.id);

    const where: any = { booking_id: { [Op.in]: bookingIds } };
    if (status) where.status = status;

    const services = await HotelService.findAll({
      where,
      limit,
      order: [['requested_at', 'DESC']],
      include: [
        {
          model: Booking,
          as: 'Booking',
          include: [
            {
              association: 'Property',
              attributes: ['id', 'name']
            }
          ]
        }
      ]
    });

    res.json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error: any) {
    console.error('Error fetching services:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch services',
      message: error.message
    });
  }
});

export default router;
