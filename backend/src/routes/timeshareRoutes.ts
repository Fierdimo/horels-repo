import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/authMiddleware';
import { authorize } from '../middleware/authorizationMiddleware';
import { requireOwnerRole } from '../middleware/ownerOnly';
import { logAction } from '../middleware/loggingMiddleware';
import { Week, SwapRequest, NightCredit, HotelService, Booking, User, Property, Role } from '../models';
import { pmsService } from '../services/pmsServiceFactory';
import sequelize from '../config/database';
import { Op } from 'sequelize';

const router = Router();

// Get owner's weeks
router.get('/weeks', authenticateToken, requireOwnerRole, authorize(['view_own_weeks']), logAction('view_weeks'), async (req: any, res: Response) => {
  try {
    const userId = req.user.id;

    // Obtener weeks del propietario
    const weeks = await Week.findAll({
      where: { owner_id: userId },
      include: [{
        association: 'Property',
        attributes: ['name', 'location']
      }],
      order: [['start_date', 'ASC']]
    });

    // Obtener también bookings confirmadas/checked_in que pertenecen a este usuario (como guest)
    // Buscar User con email que coincida con guest_email en las bookings
    const userEmail = req.user.email;
    const bookingsAsGuest = await Booking.findAll({
      where: {
        guest_email: userEmail,
        status: { [Op.in]: ['confirmed', 'checked_in', 'checked_out'] }
      },
      include: [{
        association: 'Property',
        attributes: ['name', 'location']
      }],
      order: [['check_in', 'ASC']]
    });

    // Transformar bookings al mismo formato que weeks para una respuesta consistente
    const weeksFromBookings = bookingsAsGuest.map((booking: any) => ({
      id: `booking_${booking.id}`, // ID único para distinguirlo
      owner_id: userId,
      property_id: booking.property_id,
      start_date: booking.check_in,
      end_date: booking.check_out,
      accommodation_type: booking.room_type || 'Standard',
      status: booking.status === 'checked_out' ? 'used' : 'confirmed',
      source: 'booking', // Marcar que viene de una reserva marketplace
      booking_id: booking.id,
      guest_name: booking.guest_name,
      guest_email: booking.guest_email,
      total_amount: booking.total_amount,
      Property: booking.Property
    }));

    // Combinar weeks y bookings
    const allWeeks = [...weeks, ...weeksFromBookings].sort((a: any, b: any) => {
      return new Date(a.start_date).getTime() - new Date(b.start_date).getTime();
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

    const swapRequests = await SwapRequest.findAll({
      include: [
        {
          association: 'RequesterWeek',
          include: [{ association: 'Property', attributes: ['id', 'name', 'location', 'city', 'country'] }]
        },
        {
          association: 'ResponderWeek',
          include: [{ association: 'Property', attributes: ['id', 'name', 'location', 'city', 'country'] }],
          required: false
        }
      ],
      where: {
        [Op.or]: [
          { requester_id: userId },
          { '$ResponderWeek.owner_id$': userId }
        ]
      },
      order: [['created_at', 'DESC']]
    });

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

    // Convert week to 7 night credits (standard week)
    const creditValue = 7;

    // Create night credit
    const expiryDate = new Date();
    expiryDate.setMonth(expiryDate.getMonth() + 24); // 24 months expiry

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
      message: `Week converted to ${creditValue} night credits`,
      data: {
        week: week,
        nightCredit: nightCredit
      }
    });
  } catch (error) {
    console.error('Error converting week:', error);
    res.status(500).json({ error: 'Failed to convert week' });
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

    const totalNights = credits.reduce((sum, credit) => sum + credit.remaining_nights, 0);

    res.json({
      success: true,
      data: {
        credits: credits,
        totalRemainingNights: totalNights
      }
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