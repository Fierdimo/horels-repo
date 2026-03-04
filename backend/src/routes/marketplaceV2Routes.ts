/**
 * Marketplace V2 Routes
 * 
 * Public marketplace endpoints that read from V2 database.
 * Data is seeded from Mock PMS but then operates independently.
 */

import { Router, Request, Response } from 'express';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import WeekAllocation from '../models/v2/WeekAllocation';
import Ownership from '../models/v2/Ownership';
import V2Booking from '../models/v2/V2Booking';
import { Op } from 'sequelize';
import pricingService from '../services/pricingService';
import CreditAccount from '../models/v2/CreditAccount';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

/**
 * GET /api/marketplace/properties
 * Lists all active properties from timeshare_properties.
 * Each property also surfaces its hotel rooms (rooms table, is_marketplace_enabled=true)
 * so staff-created rooms appear here alongside timeshare units.
 */
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const { city, search } = req.query;

    const where: any = { is_active: true };
    if (city) where.city = { [Op.like]: `%${city}%` };
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }

    const properties = await TimeshareProperty.findAll({
      where,
      include: [{ model: TimeshareUnit, as: 'units', where: { is_active: true }, required: false }],
      order: [['name', 'ASC']],
    });

    const propertiesData = await Promise.all(properties.map(async (property: any) => {
      const units = property.units || [];

      const timeshareCredits = units.map((u: any) => u.base_credit_value as number);
      const minPrice = timeshareCredits.length > 0 ? Math.min(...timeshareCredits) : 0;

      return {
        id: property.id,
        name: property.name,
        city: property.city,
        country: property.country,
        description: property.description,
        images: property.images ? JSON.parse(property.images) : [],
        amenities: property.amenities ? JSON.parse(property.amenities) : [],
        checkInTime: property.check_in_time || '15:00',
        checkOutTime: property.check_out_time || '11:00',
        roomTypesCount: units.length,
        minPrice,
        currency: property.condominium_fee_currency || 'EUR',
        available: units.length > 0,
      };
    }));

    res.json({
      success: true,
      count: propertiesData.length,
      data: propertiesData,
      source: 'database',
    });
  } catch (error) {
    console.error('Error fetching marketplace properties:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch properties' });
  }
});

/**
 * GET /api/marketplace/properties/:propertyId
 * Get detailed property information: timeshare units + hotel rooms.
 */
router.get('/properties/:propertyId', async (req: Request, res: Response) => {
  try {
    const propertyId = parseInt(req.params.propertyId);
    const { checkIn, checkOut } = req.query;
    const checkInDate = checkIn ? new Date(checkIn as string) : null;
    const checkOutDate = checkOut ? new Date(checkOut as string) : null;

    const property = await TimeshareProperty.findOne({
      where: { id: propertyId, is_active: true },
      include: [{ model: TimeshareUnit, as: 'units', where: { is_active: true }, required: false }],
    });

    if (!property) {
      return res.status(404).json({ success: false, error: 'Property not found' });
    }

    const propertyData: any = property.toJSON();

    const timeshareRoomTypes = await Promise.all((propertyData.units || []).map(async (unit: any) => {
      let availableRooms = unit.quantity;
      if (checkInDate && checkOutDate) {
        const activeBookings = await V2Booking.count({
          where: {
            property_id: propertyId,
            room_category: unit.category,
            status: { [Op.in]: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
            check_in: { [Op.lt]: checkOutDate },
            check_out: { [Op.gt]: checkInDate },
          },
        });
        availableRooms = Math.max(0, (unit.quantity ?? 0) - activeBookings);
      }
      const basePrice = Number(unit.base_credit_value) || 0;
      const guestPrice = basePrice > 0 ? await pricingService.calculateGuestPrice(basePrice) : 0;
      return {
        id: unit.id,
        name: unit.category,
        description: unit.description,
        capacity: unit.capacity_max,
        basePrice,
        guestPrice,
        currency: propertyData.condominium_fee_currency || 'EUR',
        images: unit.images ? JSON.parse(unit.images) : [],
        amenities: unit.amenities ? JSON.parse(unit.amenities) : [],
        quantity: unit.quantity,
        availableRooms,
        available: availableRooms > 0,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        sizeSqm: unit.size_sqm,
        source: 'timeshare',
      };
    }));

    const roomTypes = timeshareRoomTypes;

    return res.json({
      success: true,
      data: {
        id: propertyData.id,
        name: propertyData.name,
        address: propertyData.address,
        region: propertyData.region,
        postal_code: propertyData.postal_code,
        city: propertyData.city,
        country: propertyData.country,
        description: propertyData.description,
        images: propertyData.images ? JSON.parse(propertyData.images) : [],
        amenities: propertyData.amenities ? JSON.parse(propertyData.amenities) : [],
        checkInTime: propertyData.check_in_time || '15:00',
        checkOutTime: propertyData.check_out_time || '11:00',
        phone: '+34 000 000 000',
        email: `info@${propertyData.name.toLowerCase().replace(/\s/g, '')}.com`,
        timezone: 'Europe/Madrid',
        roomTypes,
      },
      source: 'database',
    });
  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch property details' });
  }
});

/**
 * GET /api/marketplace/properties/:propertyId/availability
 * Check availability for specific dates
 * Queries week_allocations table for RELEASED weeks
 */
router.get('/properties/:propertyId/availability', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;
    const { checkIn, checkOut, unitId } = req.query;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'checkIn and checkOut dates are required'
      });
    }

    // Verify property exists
    const property = await TimeshareProperty.findOne({
      where: { 
        id: parseInt(propertyId),
        is_active: true 
      }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    const checkInDate = new Date(checkIn as string);
    const checkOutDate = new Date(checkOut as string);

    // Get units for this property
    const unitsWhere: any = { 
      property_id: parseInt(propertyId),
      is_active: true 
    };
    
    if (unitId) {
      unitsWhere.id = parseInt(unitId as string);
    }

    const units = await TimeshareUnit.findAll({
      where: unitsWhere
    });

    // Check availability for each unit
    const availability = await Promise.all(units.map(async (unit: any) => {
      // Count active bookings that overlap with the requested date range
      const activeBookings = await V2Booking.count({
        where: {
          property_id: parseInt(propertyId),
          room_category: unit.category,
          status: { [Op.in]: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] },
          check_in: { [Op.lt]: checkOutDate },
          check_out: { [Op.gt]: checkInDate },
        },
      });

      const totalUnits = unit.quantity ?? 0;
      const availableUnits = Math.max(0, totalUnits - activeBookings);
      const basePrice = Number(unit.base_credit_value) || 0;
      const guestPrice = basePrice > 0 ? await pricingService.calculateGuestPrice(basePrice) : 0;

      return {
        unitId: unit.id,
        unitName: unit.category,
        totalUnits,
        availableUnits,
        available: availableUnits > 0,
        price: guestPrice,      // commission-adjusted price shown to guests
        basePrice,              // raw base price (for credit calculations)
        currency: unit.currency || 'EUR'
      };
    }));

    res.json({
      success: true,
      data: {
        propertyId: parseInt(propertyId),
        checkIn: checkInDate,
        checkOut: checkOutDate,
        availability
      }
    });
  } catch (error) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability'
    });
  }
});

/**
 * GET /api/marketplace/cities
 * Get list of cities with available properties (timeshare + hotel)
 */
router.get('/cities', async (req: Request, res: Response) => {
  try {
    // timeshare_properties IS the only properties table — single query, no duplicates
    const properties = await TimeshareProperty.findAll({
      where: { is_active: true },
      attributes: ['city', 'country'],
      group: ['city', 'country'],
    });

    const cityMap = new Map<string, { city: string; country: string; count: number }>();
    for (const p of properties) {
      const key = `${(p as any).city}|${(p as any).country}`;
      if (!cityMap.has(key)) {
        cityMap.set(key, { city: (p as any).city, country: (p as any).country, count: 0 });
      }
      cityMap.get(key)!.count++;
    }

    const citiesData = Array.from(cityMap.values()).sort((a, b) => a.city.localeCompare(b.city));

    res.json({
      success: true,
      count: citiesData.length,
      data: citiesData,
      source: 'database',
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch cities' });
  }
});

/**
 * GET /api/marketplace/search
 * Advanced search with filters
 * TODO: Reimpl with database instead of mockPMSManager
 */
/* TEMPORARILY DISABLED - Use /properties endpoint instead
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { 
      query, 
      city, 
      checkIn, 
      checkOut, 
      minPrice, 
      maxPrice,
      guests 
    } = req.query;

    let properties = mockPMSManager.getAllProperties();

    // Text search
    if (query) {
      const searchLower = (query as string).toLowerCase();
      properties = properties.filter(p =>
        p.name.toLowerCase().includes(searchLower) ||
        p.city.toLowerCase().includes(searchLower) ||
        p.description.toLowerCase().includes(searchLower)
      );
    }

    // City filter
    if (city) {
      properties = properties.filter(p => 
        p.city.toLowerCase() === (city as string).toLowerCase()
      );
    }

    // Enrich with availability and pricing
    const results = properties.map(property => {
      const roomTypes = mockPMSManager.getRoomTypes(property.id);
      
      let availableRoomTypes = roomTypes;

      // Check availability if dates provided
      if (checkIn && checkOut) {
        const checkInDate = new Date(checkIn as string);
        const checkOutDate = new Date(checkOut as string);
        
        availableRoomTypes = roomTypes.filter(rt => {
          const bookings = mockPMSManager['db'].getBookingsForRoom(
            rt.id,
            checkInDate,
            checkOutDate
          );
          return bookings.length < rt.quantity;
        });
      }

      // Filter by capacity if guests provided
      if (guests) {
        const guestCount = parseInt(guests as string);
        availableRoomTypes = availableRoomTypes.filter(rt => 
          rt.capacity >= guestCount
        );
      }

      // Filter by price range
      if (minPrice || maxPrice) {
        availableRoomTypes = availableRoomTypes.filter(rt => {
          if (minPrice && rt.basePrice < parseFloat(minPrice as string)) return false;
          if (maxPrice && rt.basePrice > parseFloat(maxPrice as string)) return false;
          return true;
        });
      }

      const lowestPrice = availableRoomTypes.length > 0
        ? Math.min(...availableRoomTypes.map(rt => rt.basePrice))
        : 0;

      return {
        id: property.id,
        name: property.name,
        city: property.city,
        country: property.country,
        description: property.description,
        images: property.images,
        amenities: property.amenities,
        availableRoomTypes: availableRoomTypes.length,
        minPrice: lowestPrice,
        currency: 'EUR',
        available: availableRoomTypes.length > 0
      };
    });

    // Filter out properties with no available rooms
    const availableResults = results.filter(r => r.available);

    res.json({
      success: true,
      count: availableResults.length,
      data: availableResults
    });
  } catch (error) {
    console.error('Error searching marketplace:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search properties'
    });
  }
});
*/

// ==================== HELPER ====================

function generateConfirmationCode(propertyId: number): string {
  const prefix = String.fromCharCode(65 + (propertyId % 26));
  const timestamp = Date.now().toString().slice(-4);
  const year = new Date().getFullYear();
  return `${prefix}${prefix}${prefix}-${timestamp}-${year}`;
}

/**
 * Determine booking source from the roomType string:
 *  - "room-N"  → HOTEL_PMS  (hotel room by numeric id)
 *  - pure number → TIMESHARE  (timeshare unit by id)
 *  - anything else → check by DB lookup; default TIMESHARE for credit pricing
 * For booking records we default unknown names to TIMESHARE so credit deduction works.
 */
function inferSource(roomType: string): 'TIMESHARE' | 'HOTEL_PMS' {
  if (roomType.startsWith('room-')) return 'HOTEL_PMS';
  if (/^\d+$/.test(roomType.trim())) return 'TIMESHARE';
  // Upper-case category names are timeshare (e.g. "STUDIO", "PENTHOUSE"); anything else hotel
  return roomType === roomType.toUpperCase() ? 'TIMESHARE' : 'HOTEL_PMS';
}

// ==================== CREDIT BALANCE ====================

/**
 * GET /api/marketplace/credits/balance/:userId
 * Returns the user's current credit wallet balance.
 */
router.get('/credits/balance/:userId', async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.userId);
    if (!userId || isNaN(userId)) {
      return res.status(400).json({ success: false, error: 'Invalid userId' });
    }
    // Use V2 credit_accounts table (not the V1 user_credit_wallets)
    let account = await CreditAccount.findOne({ where: { user_id: userId } });
    if (!account) {
      // Return zero balance rather than error if no account exists yet
      return res.json({
        success: true,
        data: { userId, balance: 0, totalEarned: 0, totalSpent: 0 },
      });
    }
    return res.json({
      success: true,
      data: {
        userId,
        balance: Number(account.balance),
        totalEarned: Number(account.total_earned),
        totalSpent: Number(account.total_spent),
      },
    });
  } catch (error) {
    console.error('Error fetching credit balance:', error);
    return res.status(500).json({ success: false, error: 'Failed to fetch credit balance' });
  }
});

// ==================== PRICING ====================

/**
 * POST /api/marketplace/properties/:propertyId/room-types/:roomType/calculate-credit-price
 * Returns the price breakdown for a booking in both credits and EUR.
 * Used by CreditPaymentSelector to show payment options.
 */
router.post(
  '/properties/:propertyId/room-types/:roomType/calculate-credit-price',
  async (req: Request, res: Response) => {
    try {
      const { propertyId, roomType } = req.params;
      const { checkIn, checkOut } = req.body;

      if (!checkIn || !checkOut) {
        return res.status(400).json({ success: false, error: 'checkIn and checkOut are required' });
      }

      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

      const rt = String(roomType);
      const isNumeric = /^\d+$/.test(rt.trim()); // "28" → timeshare by ID

      // Timeshare unit — can be numeric ID ("28") or category name ("STUDIO")
      const unitWhere: any = isNumeric
        ? { id: parseInt(rt), is_active: true }
        : { category: rt, property_id: parseInt(propertyId), is_active: true };

      const unit = await TimeshareUnit.findOne({ where: unitWhere });

      if (!unit) {
        return res.status(404).json({ success: false, error: 'Room type not found' });
      }

      const pricePerNight = Number((unit as any).base_credit_value) || 0;
      // credits stay at base rate; EUR price includes platform commission
      const guestPricePerNight = pricePerNight > 0 ? await pricingService.calculateGuestPrice(pricePerNight) : 0;
      const creditsRequired = Math.ceil(pricePerNight * nights);
      const creditToEurRate = 1; // 1 credit = 1 EUR
      const totalEur = parseFloat((guestPricePerNight * nights).toFixed(2));

      return res.json({
        success: true,
        data: { creditsRequired, totalEur, creditToEurRate, nights },
      });
    } catch (error) {
      console.error('Error calculating credit price:', error);
      return res.status(500).json({ success: false, error: 'Failed to calculate price' });
    }
  }
);

// ==================== STRIPE PAYMENT INTENT ====================

/**
 * POST /api/marketplace/properties/:propertyId/room-types/:roomType/create-payment-intent
 * Creates a Stripe PaymentIntent for the given amount.
 * The frontend passes the pre-calculated cardAmount (after any credit deduction).
 */
router.post(
  '/properties/:propertyId/room-types/:roomType/create-payment-intent',
  async (req: Request, res: Response) => {
    try {
      const { propertyId, roomType } = req.params;
      const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests, amount } = req.body;

      if (!guestName || !guestEmail || !checkIn || !checkOut) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: guestName, guestEmail, checkIn, checkOut',
        });
      }

      const property = await TimeshareProperty.findOne({
        where: { id: parseInt(propertyId), is_active: true },
      });
      if (!property) {
        return res.status(404).json({ success: false, error: 'Property not found' });
      }

      const totalAmount = parseFloat(amount) || 0;
      if (totalAmount < 0.5) {
        return res.status(400).json({
          success: false,
          error: 'Amount is below Stripe minimum (€0.50)',
        });
      }

      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);
      const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));

      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100), // Stripe uses cents
        currency: 'eur',
        automatic_payment_methods: { enabled: true },
        metadata: {
          type: 'marketplace_v2_booking',
          property_id: propertyId,
          property_name: (property as any).name,
          room_type: roomType,
          guest_name: guestName,
          guest_email: guestEmail,
          guest_phone: guestPhone || '',
          check_in: checkIn,
          check_out: checkOut,
          nights: nights.toString(),
          guests: String(guests || 1),
        },
        receipt_email: guestEmail,
      });

      return res.json({
        success: true,
        data: {
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
          amount: totalAmount,
          currency: 'eur',
          nights,
        },
      });
    } catch (error: any) {
      console.error('Error creating payment intent:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to create payment intent',
        message: error.message,
      });
    }
  }
);

// ==================== BOOKINGS ====================

/**
 * POST /api/marketplace/bookings/with-credits
 * Creates a booking using credits (optionally combined with a Stripe card payment).
 * Deducts credits from the user's wallet when creditsToUse > 0.
 */
router.post('/bookings/with-credits', async (req: Request, res: Response) => {
  try {
    const {
      propertyId,
      roomType,
      checkIn,
      checkOut,
      guests,
      guestName,
      guestEmail,
      guestPhone,
      userId,
      creditsToUse,
      paymentIntentId,
    } = req.body;

    if (!propertyId || !roomType || !checkIn || !checkOut || !guestName || !guestEmail) {
      return res.status(400).json({ success: false, error: 'Missing required booking fields' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
    const creditsUsed = Math.max(0, Number(creditsToUse) || 0);
    const isTimeshare = inferSource(String(roomType)) === 'TIMESHARE';

    // Fetch property name for the success page
    const property = await TimeshareProperty.findOne({ where: { id: parseInt(propertyId) } });
    const propertyName = property ? (property as any).name : `Property #${propertyId}`;

    // Deduct credits from credit_accounts (V2) when applicable
    let newCreditBalance: number | undefined;
    if (creditsUsed > 0 && userId) {
      const account = await CreditAccount.findOne({ where: { user_id: parseInt(userId) } });
      if (!account) {
        return res.status(400).json({ success: false, error: 'Credit account not found' });
      }
      if (Number(account.balance) < creditsUsed) {
        return res.status(400).json({ success: false, error: `Insufficient credits. Available: ${account.balance}, required: ${creditsUsed}` });
      }
      newCreditBalance = Number(account.balance) - creditsUsed;
      await account.update({
        balance: newCreditBalance,
        total_spent: Number(account.total_spent) + creditsUsed,
        last_transaction_at: new Date(),
      });
    }

    // Determine cash amount: if a paymentIntentId is provided, the card portion was handled by Stripe.
    // We store it as cash_paid = 0 for now; the actual EUR figure can be reconciled via Stripe webhooks.
    const cashPaid = paymentIntentId ? 0 : 0; // Could be improved with PI retrieval

    const confirmationCode = generateConfirmationCode(parseInt(propertyId));

    const booking = await V2Booking.create({
      booking_code: confirmationCode,   // Sequelize attr 'booking_code' maps to DB column 'confirmation_code'
      guest_id: userId ? parseInt(userId) : null,
      property_id: parseInt(propertyId),
      check_in: checkInDate,
      check_out: checkOutDate,
      nights,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      number_of_guests: parseInt(guests) || 1,
      room_category: String(roomType),
      source: isTimeshare ? 'TIMESHARE' : 'HOTEL_PMS',
      credits_used: creditsUsed,
      cash_paid: cashPaid,
      currency: 'EUR',
      platform_cost: 0,
      platform_revenue: creditsUsed + cashPaid,
      margin_percent: isTimeshare ? 100 : 30,
      status: 'CONFIRMED',
      pms_provider: null,
      pms_booking_id: paymentIntentId || null,
    } as any);

    return res.json({
      success: true,
      data: {
        id: booking.id,
        confirmationNumber: confirmationCode,
        property: propertyName,
        propertyId,
        roomType,
        checkIn,
        checkOut,
        nights,
        guests: parseInt(guests) || 1,
        guestName,
        guestEmail,
        creditsUsed,
        cashPaid,
        totalAmount: cashPaid,
        currency: 'EUR',
        newCreditBalance,
        status: booking.status,
      },
    });
  } catch (error: any) {
    console.error('Error creating booking with credits:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create booking',
      message: error.message,
    });
  }
});

/**
 * POST /api/marketplace/bookings
 * Creates a booking record after a successful Stripe card payment.
 */
router.post('/bookings', async (req: Request, res: Response) => {
  try {
    const {
      propertyId,
      roomType,
      checkIn,
      checkOut,
      guests,
      guestName,
      guestEmail,
      guestPhone,
      userId,
      paymentIntentId,
      totalAmount,
      currency,
      nights: reqNights,
    } = req.body;

    if (!propertyId || !roomType || !checkIn || !checkOut || !guestName || !guestEmail) {
      return res.status(400).json({ success: false, error: 'Missing required booking fields' });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = reqNights
      ? parseInt(reqNights)
      : Math.max(1, Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)));
    const cashPaid = parseFloat(totalAmount) || 0;
    const isTimeshare = inferSource(String(roomType)) === 'TIMESHARE';

    // Fetch property name for the success page
    const property = await TimeshareProperty.findOne({ where: { id: parseInt(propertyId) } });
    const propertyName = property ? (property as any).name : `Property #${propertyId}`;

    const confirmationCode = generateConfirmationCode(parseInt(propertyId));

    const booking = await V2Booking.create({
      booking_code: confirmationCode,   // Sequelize attr 'booking_code' maps to DB column 'confirmation_code'
      guest_id: userId ? parseInt(userId) : null,
      property_id: parseInt(propertyId),
      check_in: checkInDate,
      check_out: checkOutDate,
      nights,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      number_of_guests: parseInt(guests) || 1,
      room_category: String(roomType),
      source: isTimeshare ? 'TIMESHARE' : 'HOTEL_PMS',
      credits_used: 0,
      cash_paid: cashPaid,
      currency: currency || 'EUR',
      platform_cost: 0,
      platform_revenue: cashPaid,
      margin_percent: isTimeshare ? 100 : 30,
      status: 'CONFIRMED',
      pms_provider: null,
      pms_booking_id: paymentIntentId || null,
    } as any);

    return res.json({
      success: true,
      data: {
        id: booking.id,
        confirmationNumber: confirmationCode,
        property: propertyName,
        propertyId,
        roomType,
        checkIn,
        checkOut,
        nights,
        guests: parseInt(guests) || 1,
        guestName,
        guestEmail,
        cashPaid,
        totalAmount: cashPaid,
        currency: currency || 'EUR',
        creditsUsed: 0,
        status: booking.status,
        paymentIntentId,
      },
    });
  } catch (error: any) {
    console.error('Error creating booking:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to create booking',
      message: error.message,
    });
  }
});

export default router;
