import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorize } from '../middleware/authorizationMiddleware';
import { requireOwnerRole } from '../middleware/ownerOnly';
import { logAction } from '../middleware/loggingMiddleware';
import { Week, SwapRequest, NightCredit, HotelService, Booking, User, Property, Role } from '../models';
import { pmsService } from '../services/pmsServiceFactory';
import SwapService from '../services/swapService';
import sequelize from '../config/database';
import { Op } from 'sequelize';

const router = Router();

// Get owner dashboard statistics
router.get('/dashboard', authenticateToken, requireOwnerRole, logAction('view_owner_dashboard'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get total weeks from Week model
    const totalWeeksFromModel = await Week.count({
      where: { owner_id: userId }
    });

    // Get ALL bookings (invitations + marketplace)
    const allUserBookings = await Booking.findAll({
      where: {
        guest_email: req.user.email,
        status: { [Op.notIn]: ['cancelled'] }
      },
      attributes: ['id', 'raw', 'check_in', 'status'],
      raw: true
    });

    // Count bookings from invitations
    const invitationBookings = allUserBookings.filter(booking => {
      if (!booking.raw) return false;
      try {
        const metadata = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
        return metadata?.booking_type === 'owner_invitation';
      } catch (e) {
        return false;
      }
    });

    // Count marketplace bookings (no metadata or different booking_type)
    const marketplaceBookings = allUserBookings.filter(booking => {
      if (!booking.raw) return true; // No metadata = marketplace
      try {
        const metadata = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
        return metadata?.booking_type !== 'owner_invitation';
      } catch (e) {
        return true;
      }
    });

    const totalWeeks = totalWeeksFromModel + allUserBookings.length;

    // Get available weeks (future dates, not used/swapped)
    const availableWeeksFromModel = await Week.count({
      where: {
        owner_id: userId,
        start_date: { [Op.gte]: today },
        status: { [Op.in]: ['available', 'confirmed'] }
      }
    });

    // Count future bookings (invitation + marketplace)
    const futureBookings = allUserBookings.filter(booking => {
      const checkIn = new Date(booking.check_in);
      return checkIn >= today && ['confirmed', 'checked_in', 'pending_approval'].includes(booking.status);
    });

    const availableWeeks = availableWeeksFromModel + futureBookings.length;

    // Get active swaps (pending or accepted)
    const activeSwaps = await SwapRequest.count({
      where: {
        [Op.or]: [
          { requester_id: userId },
          { responder_id: userId }
        ],
        status: { [Op.in]: ['pending', 'accepted'] }
      }
    });

    // Upcoming marketplace bookings (future, confirmed, not from invitations)
    const upcomingMarketplaceBookings = marketplaceBookings.filter(booking => {
      const checkIn = new Date(booking.check_in);
      return checkIn >= today && ['confirmed', 'checked_in'].includes(booking.status);
    }).length;

    // Get credits info (if UserCreditWallet exists)
    let creditsInfo = null;
    try {
      const { UserCreditWallet } = require('../models');
      const wallet = await UserCreditWallet.findOne({
        where: { user_id: userId }
      });
      
      if (wallet) {
        creditsInfo = {
          total: parseFloat(wallet.total_balance) || 0,
          available: parseFloat(wallet.total_balance) || 0,
          expiringSoon: parseFloat(wallet.pending_expiration) || 0
        };
      }
    } catch (error) {
      console.log('[Dashboard] Credit wallet not available yet');
    }

    // Get recent activity (last 5 weeks or swaps)
    const recentWeeks = await Week.findAll({
      where: { owner_id: userId },
      include: [{
        association: 'Property',
        attributes: ['name', 'location', 'city', 'country']
      }],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    // Get recent bookings (including invitations and marketplace)
    const recentBookings = await Booking.findAll({
      where: {
        guest_email: req.user.email,
        status: { [Op.notIn]: ['cancelled'] }
      },
      include: [{
        model: require('../models').Property,
        as: 'Property',
        attributes: ['name', 'location', 'city', 'country']
      }],
      order: [['created_at', 'DESC']],
      limit: 5
    });

    // Combine weeks and bookings for recent activity
    const combinedRecentActivity = [
      ...recentWeeks.map(week => ({
        ...week.toJSON(),
        type: 'week',
        start_date: week.start_date,
        end_date: week.end_date
      })),
      ...recentBookings.map(booking => ({
        id: `booking_${booking.id}`,
        type: 'booking',
        status: booking.status,
        start_date: booking.check_in,
        end_date: booking.check_out,
        Property: booking.Property,
        created_at: booking.created_at
      }))
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5);

    const recentSwaps = await SwapRequest.findAll({
      where: {
        [Op.or]: [
          { requester_id: userId },
          { responder_id: userId }
        ]
      },
      order: [['created_at', 'DESC']],
      limit: 3
    });

    console.log('[Dashboard] Stats:', {
      totalWeeksFromModel,
      totalBookings: allUserBookings.length,
      invitationBookings: invitationBookings.length,
      marketplaceBookings: marketplaceBookings.length,
      totalWeeks,
      availableWeeks,
      futureBookings: futureBookings.length,
      activeSwaps,
      upcomingMarketplaceBookings,
      userId: req.user.id,
      email: req.user.email
    });

    res.json({
      success: true,
      data: {
        stats: {
          totalWeeks,
          availableWeeks,
          activeSwaps,
          upcomingBookings: upcomingMarketplaceBookings
        },
        credits: creditsInfo,
        recentActivity: {
          weeks: combinedRecentActivity,
          swaps: recentSwaps
        }
      }
    });
  } catch (error: any) {
    console.error('Error fetching owner dashboard:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dashboard data',
      message: error.message
    });
  }
});

// Get owner's weeks
router.get('/weeks', authenticateToken, requireOwnerRole, logAction('view_weeks'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const filter = req.query.filter as string; // 'available' | 'all'
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Start of today

    // Build where clause for weeks
    const weekWhere: any = { 
      owner_id: userId,
      status: { [Op.ne]: 'pending_swap' } // Always exclude pending_swap
    };
    
    // If filter is 'available', only show future dates
    if (filter === 'available') {
      weekWhere.start_date = { [Op.gte]: today };
    }

    // Obtener weeks del propietario
    const weeks = await Week.findAll({
      where: weekWhere,
      include: [{
        association: 'Property',
        attributes: ['name', 'location', 'city', 'country']
      }],
      order: [['start_date', 'ASC']]
    });

    // Build where clause for bookings
    const bookingWhere: any = {
      guest_email: req.user.email,
      status: { [Op.notIn]: ['pending_swap', 'cancelled'] } // Exclude pending_swap and cancelled
    };

    // If filter is 'available', only show future dates and exclude checked_out
    if (filter === 'available') {
      bookingWhere.check_in = { [Op.gte]: today };
      bookingWhere.status = { [Op.in]: ['confirmed', 'checked_in', 'pending'] }; // Include pending
    }

    // Obtener también bookings que pertenecen a este usuario (como guest)
    const bookingsAsGuest = await Booking.findAll({
      where: bookingWhere,
      include: [{
        association: 'Property',
        attributes: ['name', 'location', 'city', 'country']
      }],
      attributes: { include: ['acquired_via_swap_id', 'raw'] }, // Include swap info and metadata
      order: [['check_in', 'ASC']]
    });

    // Transformar bookings al mismo formato que weeks para una respuesta consistente
    const weeksFromBookings = bookingsAsGuest.map((booking: any) => {
      // Parse raw metadata
      const metadata = booking.raw ? (typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw) : {};
      
      return {
        id: `booking_${booking.id}`, // ID único para distinguirlo
        owner_id: userId,
        property_id: booking.property_id,
        start_date: booking.check_in,
        end_date: booking.check_out,
        accommodation_type: booking.room_type || 'Standard',
        status: booking.status, // Keep original status (pending, confirmed, checked_in, etc.)
        source: 'booking', // Marcar que viene de una reserva marketplace
        acquired_via_swap: booking.acquired_via_swap_id ? true : false, // Indicar si fue por swap
        acquired_via_swap_id: booking.acquired_via_swap_id,
        booking_id: booking.id,
        booking_type: metadata.booking_type || null, // Include booking_type from metadata
        guest_name: booking.guest_name,
        guest_email: booking.guest_email,
        total_amount: booking.total_amount,
        Property: booking.Property,
        raw: booking.raw // Include full metadata
      };
    });

    // Combinar weeks y bookings
    const allWeeks = [...weeks, ...weeksFromBookings].sort((a: any, b: any) => {
      // Handle floating periods (put them at the end or use created_at)
      const aDate = a.start_date ? new Date(a.start_date).getTime() : new Date(a.created_at).getTime() + 999999999999;
      const bDate = b.start_date ? new Date(b.start_date).getTime() : new Date(b.created_at).getTime() + 999999999999;
      return aDate - bDate;
    });

    res.json({
      success: true,
      data: allWeeks,
      count: allWeeks.length
    });
  } catch (error) {
    console.error('Error fetching weeks:', error);
    res.status(500).json({ error: 'Failed to fetch weeks' });
  }
});

// Get single week details
router.get('/weeks/:weekId', authenticateToken, requireOwnerRole, authorize(['view_own_weeks']), logAction('view_week_details'), async (req: any, res: Response) => {
  try {
    const { weekId } = req.params;
    const userId = req.user.id;

    const week = await Week.findOne({
      where: { id: weekId, owner_id: userId },
      include: [{
        association: 'Property',
        attributes: ['name', 'location', 'city', 'country']
      }]
    });

    if (!week) {
      return res.status(404).json({ 
        success: false,
        error: 'Week not found or you do not have permission to view it' 
      });
    }

    res.json({
      success: true,
      data: week
    });
  } catch (error) {
    console.error('Error fetching week details:', error);
    res.status(500).json({ 
      success: false,
      error: 'Failed to fetch week details' 
    });
  }
});

// Get all bookings for the authenticated owner
router.get('/bookings', authenticateToken, requireOwnerRole, logAction('view_my_bookings'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId, { attributes: ['email'] });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get all bookings where user is the guest
    const bookings = await Booking.findAll({
      where: {
        guest_email: user.email
      },
      include: [
        {
          association: 'Property',
          attributes: ['id', 'name', 'city', 'country', 'stars']
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Enrich with payment and rejection info
    const enrichedBookings = bookings.map((booking: any) => {
      let metadata = {};
      let rejectionReason = null;
      let creditsUsed = null;

      if (booking.raw) {
        try {
          metadata = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
          rejectionReason = (metadata as any).rejection_reason || null;
          creditsUsed = (metadata as any).credits_required || null;
        } catch (e) {
          console.error('Failed to parse booking metadata:', e);
        }
      }

      return {
        id: booking.id,
        propertyId: booking.property_id,
        propertyName: booking.Property?.name || 'Unknown Property',
        propertyCity: booking.Property?.city || '',
        propertyCountry: booking.Property?.country || '',
        roomType: booking.room_type,
        checkIn: booking.check_in,
        checkOut: booking.check_out,
        guestName: booking.guest_name,
        status: booking.status,
        paymentStatus: booking.payment_status,
        paymentMethod: booking.payment_method,
        totalAmount: booking.total_amount,
        creditsUsed,
        rejectionReason,
        createdAt: booking.created_at
      };
    });

    res.json({
      success: true,
      data: enrichedBookings,
      count: enrichedBookings.length
    });
  } catch (error) {
    console.error('Error fetching owner bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get booking details for owner (marketplace booking)
router.get('/bookings/:bookingId', authenticateToken, logAction('view_booking_details'), async (req: any, res: Response) => {
  try {
    const { bookingId } = req.params;
    const userId = req.user.id;

    const booking = await Booking.findByPk(bookingId, {
      include: [
        {
          association: 'Property',
          attributes: ['id', 'name', 'location', 'city', 'country', 'stars', 'amenities']
        },
        {
          association: 'Services',
          attributes: ['id', 'service_type', 'status', 'price', 'quantity', 'notes']
        }
      ]
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    // Verify authorization:
    // 1. User is property staff/owner (has matching property_id), OR
    // 2. User is the guest who made the booking (email matches)
    const user = await User.findByPk(userId, {
      attributes: ['email', 'property_id']
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const isPropertyStaff = user.property_id === (booking as any).property_id;
    const isGuest = user.email === (booking as any).guest_email;

    if (!isPropertyStaff && !isGuest) {
      return res.status(403).json({ error: 'Unauthorized to view this booking' });
    }

    res.json({
      success: true,
      data: booking
    });
  } catch (error) {
    console.error('Error fetching booking details:', error);
    res.status(500).json({ error: 'Failed to fetch booking details' });
  }
});

// Confirm week usage
router.post('/weeks/:weekId/confirm', authenticateToken, requireOwnerRole, authorize(['confirm_week']), logAction('confirm_week'), async (req: any, res: Response) => {
  try {
    const { weekId } = req.params;
    const userId = req.user.id;

    const week = await Week.findOne({
      where: { id: weekId, owner_id: userId, status: 'available' }
    });

    if (!week) {
      return res.status(404).json({ error: 'Week not found or not available' });
    }

    // Update week status
    await week.update({ status: 'confirmed' });

    res.json({
      success: true,
      message: 'Week confirmed successfully',
      data: week
    });
  } catch (error) {
    console.error('Error confirming week:', error);
    res.status(500).json({ error: 'Failed to confirm week' });
  }
});

// Get available swaps to browse (swaps from other users that are pending)
router.get('/swaps/browse/available', authenticateToken, requireOwnerRole, authorize(['view_own_weeks']), logAction('browse_available_swaps'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    
    console.log('[GET /swaps/browse/available] userId:', userId);
    
    // Get swaps that:
    // 1. Are in 'pending' status (waiting for someone to accept)
    // 2. Were NOT created by the current user
    // 3. Include full week/booking details
    const availableSwaps = await SwapService.getAvailableSwapsForBrowse(userId);
    
    console.log('[GET /swaps/browse/available] Found', availableSwaps.length, 'available swaps');
    
    res.json({
      success: true,
      data: availableSwaps
    });
  } catch (error) {
    console.error('Error fetching available swaps:', error);
    res.status(500).json({ error: 'Failed to fetch available swaps' });
  }
});

// Create swap request
router.post('/swaps', authenticateToken, requireOwnerRole, authorize(['view_own_weeks']), logAction('create_swap_request'), async (req: any, res: Response) => {
  try {
    const { weekId, desiredStartDate, desiredEndDate, notes } = req.body;
    const userId = req.user.id;

    const week = await Week.findOne({
      where: { id: weekId, owner_id: userId, status: 'available' },
      include: [{ model: Property, as: 'Property' }]
    });

    if (!week) {
      return res.status(404).json({ error: 'Week not found or not available for swap' });
    }

    // Verificar que la property tenga al menos un staff activo
    const activeStaff = await User.findOne({
      where: {
        property_id: (week as any).property_id,
        status: 'approved'
      },
      include: [{
        model: Role,
        where: { name: 'staff' },
        required: true
      }]
    });

    if (!activeStaff) {
      return res.status(400).json({ error: 'Property is not available for swaps (no active staff)' });
    }

    // Create swap request (fee will be calculated when approved)
    const swapRequest = await SwapRequest.create({
      requester_week_id: weekId,
      requester_id: userId,
      desired_start_date: desiredStartDate,
      desired_end_date: desiredEndDate,
      status: 'pending',
      notes
    });

    res.json({
      success: true,
      message: 'Swap request created successfully',
      data: swapRequest
    });
  } catch (error) {
    console.error('Error creating swap request:', error);
    res.status(500).json({ error: 'Failed to create swap request' });
  }
});

// Authorize a swap (responder/owner of the responder week or staff/admin)
router.post('/swaps/:swapId/authorize', authenticateToken, requireOwnerRole, authorize(['accept_swap']), logAction('authorize_swap'), async (req: any, res: Response) => {
  try {
    const { swapId } = req.params;
    const { responderWeekId } = req.body;
    const userId = req.user.id;

    const swap = await SwapRequest.findByPk(swapId);
    if (!swap) {
      return res.status(404).json({ error: 'Swap not found' });
    }

    if (swap.status !== 'pending') {
      return res.status(400).json({ error: 'Swap is not in pending state' });
    }

    if (responderWeekId) {
      const week = await Week.findByPk(responderWeekId);
      if (!week) {
        return res.status(404).json({ error: 'Responder week not found' });
      }

      // Only the owner of the responder week or admin/staff can authorize
      if (week.owner_id !== userId && req.user.Role?.name !== 'admin' && req.user.Role?.name !== 'staff') {
        return res.status(403).json({ error: 'Insufficient permissions to authorize this swap' });
      }

      await swap.update({ responder_week_id: responderWeekId, status: 'matched' });
    } else {
      // If no responderWeekId provided, allow staff/admin to mark matched
      if (req.user.Role?.name !== 'admin' && req.user.Role?.name !== 'staff') {
        return res.status(403).json({ error: 'Responder week required unless admin/staff' });
      }
      await swap.update({ status: 'matched' });
    }

    res.json({ success: true, message: 'Swap authorized', data: swap });
  } catch (error) {
    console.error('Error authorizing swap:', error);
    res.status(500).json({ error: 'Failed to authorize swap' });
  }
});

// Get swap requests for owner's weeks
router.get('/swaps', authenticateToken, requireOwnerRole, authorize(['view_own_weeks']), logAction('view_swap_requests'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const role = req.query.role as 'requester' | 'responder' | 'both' | undefined;

    console.log('[GET /owner/swaps] userId:', userId, 'role:', role);

    // Use SwapService to get swaps with proper booking enrichment
    const swapRequests = await SwapService.getOwnerSwaps(userId, role || 'both');

    console.log('[GET /owner/swaps] Found', swapRequests.length, 'swaps');

    res.json({
      success: true,
      data: swapRequests
    });
  } catch (error) {
    console.error('Error fetching swap requests:', error);
    res.status(500).json({ error: 'Failed to fetch swap requests' });
  }
});

// Convert week to night credits
router.post('/weeks/:weekId/convert', authenticateToken, requireOwnerRole, authorize(['view_own_weeks']), logAction('convert_week_to_credits'), async (req: any, res: Response) => {
  try {
    const { weekId } = req.params;
    const userId = req.user.id;

    const week = await Week.findOne({
      where: { id: weekId, owner_id: userId, status: 'available' }
    });

    if (!week) {
      return res.status(404).json({ error: 'Week not found or not available for conversion' });
    }

    // Calculate nights: use 'nights' field for floating periods, or calculate from dates
    let nights: number;
    
    if (week.nights) {
      // Floating period: use the nights field directly
      nights = week.nights;
    } else if (week.start_date && week.end_date) {
      // Fixed period: calculate from dates
      const startDate = new Date(week.start_date);
      const endDate = new Date(week.end_date);
      nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      return res.status(400).json({ error: 'Invalid period: missing nights or dates' });
    }

    // Validate period has at least 1 night
    if (nights < 1) {
      return res.status(400).json({ error: 'Period must have at least 1 night' });
    }

    // Convert period to night credits (1 night = 1 credit)
    const creditValue = nights;

    // Create night credit with expiry: use valid_until if available, otherwise 18 months from now
    let expiryDate: Date;
    if (week.valid_until) {
      expiryDate = new Date(week.valid_until);
    } else {
      expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + 18); // 18 months expiry
    }

    const nightCredit = await NightCredit.create({
      owner_id: userId,
      original_week_id: weekId,
      total_nights: creditValue,
      remaining_nights: creditValue,
      expiry_date: expiryDate,
      status: 'active'
    });

    // Update week status
    await week.update({ status: 'converted' });

    res.json({
      success: true,
      message: `Period of ${nights} night(s) converted to ${creditValue} night credits`,
      data: {
        week: week,
        nightCredit: nightCredit,
        nights: nights,
        credits: creditValue
      }
    });
  } catch (error) {
    console.error('Error converting period:', error);
    res.status(500).json({ error: 'Failed to convert period' });
  }
});

// Get owner's night credits
router.get('/night-credits', authenticateToken, requireOwnerRole, authorize(['view_own_weeks']), logAction('view_night_credits'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    const credits = await NightCredit.findAll({
      where: {
        owner_id: userId,
        status: 'active',
        expiry_date: { [Op.gt]: new Date() }
      },
      order: [['expiry_date', 'ASC']]
    });

    // Map to format expected by frontend
    const formattedCredits = credits.map(credit => ({
      id: credit.id,
      nights_available: credit.total_nights,
      nights_used: credit.total_nights - credit.remaining_nights,
      expires_at: credit.expiry_date,
      created_at: credit.created_at,
      // Include original fields for compatibility
      total_nights: credit.total_nights,
      remaining_nights: credit.remaining_nights,
      expiry_date: credit.expiry_date
    }));

    res.json({
      success: true,
      data: formattedCredits
    });
  } catch (error) {
    console.error('Error fetching night credits:', error);
    res.status(500).json({ error: 'Failed to fetch night credits' });
  }
});

// Use night credits for booking
router.post('/night-credits/:creditId/use', authenticateToken, requireOwnerRole, authorize(['view_own_weeks']), logAction('use_night_credits'), async (req: any, res: Response) => {
  try {
    const { creditId } = req.params;
    const { propertyId, checkIn, checkOut, roomType } = req.body;
    const userId = req.user.id;

    const credit = await NightCredit.findOne({
      where: {
        id: creditId,
        owner_id: userId,
        status: 'active',
        expiry_date: { [Op.gt]: new Date() }
      }
    });

    if (!credit) {
      return res.status(404).json({ error: 'Night credit not found or expired' });
    }

    // Calculate nights needed
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nightsNeeded = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    if (credit.remaining_nights < nightsNeeded) {
      return res.status(400).json({ error: 'Insufficient night credits' });
    }

    // Idempotency key can be supplied in header `Idempotency-Key` or body.idempotencyKey
    const idempotencyKey = req.header('Idempotency-Key') || req.body.idempotencyKey || null;

    // If a booking with the same idempotency key already exists, return it (idempotent)
    if (idempotencyKey) {
      const existing = await Booking.findOne({ where: { idempotency_key: idempotencyKey } });
      if (existing) {
        return res.json({ success: true, message: 'Idempotent: returning existing booking', data: { booking: existing } });
      }
    }

    // Call PMS to check availability and create booking
    try {
      const propertyNumericId = Number(propertyId);
      const pmsRes = await pmsService.checkAvailability(propertyNumericId || 0, checkIn, checkOut, nightsNeeded);

      if (!pmsRes || (pmsRes.availableNights ?? 0) === 0) {
        return res.status(409).json({ error: 'No availability for requested dates', pms: pmsRes });
      }

      if (!pmsRes.available && (pmsRes.availableNights ?? 0) < nightsNeeded) {
        // Partial availability — surface info to caller
        return res.status(409).json({ error: 'Partial availability', availableNights: pmsRes.availableNights, reason: pmsRes.reason });
      }

      // If available, proceed to create booking in PMS (or simulate if adapter is mock)
      // Attempt to create booking in the configured PMS adapter
      const user = await User.findByPk(userId);
      const guestName = (user && (user as any).full_name) || (user && (user as any).email) || 'Guest';
      const guestEmail = (user && (user as any).email) || `guest-${Date.now()}@example.com`;

      const bookingCreation = typeof (pmsService as any).createBooking === 'function'
        ? await (pmsService as any).createBooking({ propertyId: Number(propertyId), guestName, guestEmail, checkIn, checkOut, roomType, nights: nightsNeeded, idempotencyKey, nightCreditId: String(creditId), origin: 'Timeshare' })
        : null;

      // If PMS booking failed, return an error
      if (bookingCreation && bookingCreation.status !== 'confirmed') {
        return res.status(502).json({ error: 'Failed to create booking in PMS', details: bookingCreation });
      }

      // Use a transaction to atomically create booking and decrement credit
      const tx = await sequelize.transaction();
      try {
        // Re-check idempotency inside transaction to avoid race
        if (idempotencyKey) {
          const existingTx = await Booking.findOne({ where: { idempotency_key: idempotencyKey }, transaction: tx });
          if (existingTx) {
            await tx.rollback();
            return res.json({ success: true, message: 'Idempotent: returning existing booking', data: { booking: existingTx } });
          }
        }

        const booking = await Booking.create({
          property_id: propertyId,
          guest_name: guestName,
          guest_email: guestEmail,
          check_in: checkIn,
          check_out: checkOut,
          room_type: roomType,
          status: 'confirmed',
          guest_token: bookingCreation && bookingCreation.guestToken ? bookingCreation.guestToken : `gt_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
          pms_booking_id: bookingCreation ? bookingCreation.pmsBookingId : null,
          pms_provider: bookingCreation ? bookingCreation.provider : null,
          payment_reference: bookingCreation && bookingCreation.externalRefs ? bookingCreation.externalRefs.paymentReference : null,
          idempotency_key: idempotencyKey,
          night_credit_id: String(creditId),
          raw: bookingCreation ? bookingCreation.raw : null
        }, { transaction: tx });

        // Update credit balance only after successful booking creation
        const remaining = credit.remaining_nights - nightsNeeded;
        await credit.update({
          remaining_nights: remaining,
          status: remaining === 0 ? 'used' : 'active'
        }, { transaction: tx });

        await tx.commit();

        res.json({
          success: true,
          message: `${nightsNeeded} night credits used successfully`,
          data: {
            nightsUsed: nightsNeeded,
            remainingNights: remaining,
            booking: booking
          }
        });
      } catch (txErr) {
        await tx.rollback();
        console.error('Transaction error creating booking and updating credit:', txErr);
        return res.status(500).json({ error: 'Failed to persist booking or update credit' });
      }
    } catch (err: any) {
      console.error('Error checking PMS availability or creating booking:', err?.message || err);
      return res.status(500).json({ error: 'Failed to check availability or create booking' });
    }
  } catch (error) {
    console.error('Error using night credits:', error);
    res.status(500).json({ error: 'Failed to use night credits' });
  }
});

export default router;