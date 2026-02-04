/**
 * Marketplace V2 Routes
 * 
 * Public marketplace endpoints that read from V2 database.
 * Data is seeded from Mock PMS but then operates independently.
 */

import { Router, Request, Response } from 'express';
import TimeshareProperty from '../models/v2/TimeshareProperty';
import TimeshareUnit from '../models/v2/TimeshareUnit';
import WeekAllocation from '../models/v2/WeekAllocation';
import Ownership from '../models/v2/Ownership';
import V2Booking from '../models/v2/V2Booking';
import { Op, QueryTypes } from 'sequelize';
import pricingService from '../services/pricingService';
import Stripe from 'stripe';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

/**
 * GET /api/marketplace/properties
 * Get all available properties for marketplace
 * Reads from timeshare_properties table (seeded from Mock PMS)
 */
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const { city, search } = req.query;

    // Build query conditions
    const whereConditions: any = {
      is_active: true
    };

    if (city) {
      whereConditions.city = { [Op.like]: `%${city}%` };
    }

    if (search) {
      whereConditions[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    // Fetch properties with their units
    const properties = await TimeshareProperty.findAll({
      where: whereConditions,
      include: [{
        model: TimeshareUnit,
        as: 'units',
        where: { is_active: true },
        required: false
      }],
      order: [['name', 'ASC']]
    });

    // Format response
    const propertiesData = properties.map((property: any) => {
      const units = property.units || [];
      const minPrice = units.length > 0 
        ? Math.min(...units.map((u: any) => u.base_credit_value))
        : 0;
      
      return {
        id: property.id,
        name: property.name,
        city: property.city,
        country: property.country,
        description: property.description,
        images: property.images ? JSON.parse(property.images) : [],
        amenities: property.amenities ? JSON.parse(property.amenities) : [],
        checkInTime: '15:00',
        checkOutTime: '11:00',
        phone: '+34 000 000 000',
        email: `info@${property.name.toLowerCase().replace(/\s/g, '')}.com`,
        timezone: 'Europe/Madrid',
        roomTypesCount: units.length,
        minPrice,
        currency: property.condominium_fee_currency,
        available: true
      };
    });

    res.json({
      success: true,
      count: propertiesData.length,
      data: propertiesData,
      source: 'database'
    });
  } catch (error) {
    console.error('Error fetching marketplace properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties'
    });
  }
});

/**
 * GET /api/marketplace/properties/:propertyId
 * Get detailed property information including room types
 * Reads from database (timeshare_properties + timeshare_units)
 */
router.get('/properties/:propertyId', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;

    // Fetch property with units
    const property = await TimeshareProperty.findOne({
      where: { 
        id: parseInt(propertyId),
        is_active: true 
      },
      include: [{
        model: TimeshareUnit,
        as: 'units',
        where: { is_active: true },
        required: false
      }]
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Format response
    const propertyData: any = property.toJSON();
    
    res.json({
      success: true,
      data: {
        id: propertyData.id,
        name: propertyData.name,
        address: propertyData.address,
        city: propertyData.city,
        country: propertyData.country,
        description: propertyData.description,
        images: propertyData.images ? JSON.parse(propertyData.images) : [],
        amenities: propertyData.amenities ? JSON.parse(propertyData.amenities) : [],
        checkInTime: '15:00',
        checkOutTime: '11:00',
        phone: '+34 000 000 000',
        email: `info@${propertyData.name.toLowerCase().replace(/\s/g, '')}.com`,
        timezone: 'Europe/Madrid',
        roomTypes: (propertyData.units || []).map((unit: any) => ({
          id: unit.id,
          name: unit.name,
          description: unit.description,
          capacity: unit.max_occupancy,
          basePrice: unit.base_credit_value,
          currency: propertyData.condominium_fee_currency,
          images: unit.images ? JSON.parse(unit.images) : [],
          amenities: unit.amenities ? JSON.parse(unit.amenities) : [],
          quantity: unit.quantity,
          available: true,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          sizeSqm: unit.size_sqm
        }))
      },
      source: 'database'
    });
  } catch (error) {
    console.error('Error fetching property details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property details'
    });
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
    
    // Debug: Check all bookings for this property
    console.log('🔍 DEBUG: Checking all bookings for property', propertyId);
    const allBookings = await V2Booking.findAll({
      where: {
        property_id: parseInt(propertyId),
        status: { [Op.in]: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }
      },
      attributes: ['id', 'room_category', 'check_in', 'check_out', 'status'],
      raw: true
    });
    console.log('📋 All active hotel bookings:', allBookings);
    
    // Debug: Check all timeshare week allocations for this property
    // First, let's see ALL week allocations regardless of status
    const sequelize = WeekAllocation.sequelize;
    const allWeeksRaw = await sequelize!.query(
      `SELECT wa.*, o.unit_id, tu.category as unit_category
       FROM week_allocations wa
       JOIN ownerships o ON wa.ownership_id = o.id
       JOIN timeshare_units tu ON o.unit_id = tu.id
       WHERE tu.property_id = ?
       ORDER BY wa.start_date`,
      {
        replacements: [parseInt(propertyId)],
        type: QueryTypes.SELECT
      }
    );
    console.log('📋 ALL week allocations for property (raw SQL):', allWeeksRaw);
    
    // Now check only RESERVED/BOOKED
    const allWeekAllocations = await WeekAllocation.findAll({
      where: {
        status: { [Op.in]: ['RESERVED', 'BOOKED'] }
      },
      include: [{
        model: Ownership,
        as: 'ownership',
        required: true,
        include: [{
          model: TimeshareUnit,
          as: 'unit',
          where: { property_id: parseInt(propertyId) },
          required: true,
          attributes: ['id', 'category']
        }]
      }],
      attributes: ['id', 'status', 'start_date', 'end_date'],
      raw: true,
      nest: true
    });
    console.log('📋 Active timeshare reservations (RESERVED/BOOKED):', allWeekAllocations);

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
      // Calculate total inventory for this unit type
      const totalUnits = unit.quantity || 0;
      
      // Debug: log unit structure
      console.log('🔍 Unit structure:', {
        id: unit.id,
        category: unit.category,
        quantity: unit.quantity,
        fields: Object.keys(unit.dataValues || unit)
      });
      
      console.log('🔍 Checking bookings for:', {
        property_id: parseInt(propertyId),
        room_category: unit.category,
        checkInDate,
        checkOutDate
      });
      
      // Count existing bookings from v2_bookings table (hotel bookings)
      const hotelBookings = await V2Booking.count({
        where: {
          property_id: parseInt(propertyId),
          room_category: unit.category || unit.name,
          status: {
            [Op.in]: ['PENDING', 'CONFIRMED', 'CHECKED_IN']
          },
          check_out: { [Op.gt]: checkInDate },
          check_in: { [Op.lt]: checkOutDate }
        }
      });
      
      // For MARKETPLACE availability calculation:
      // Strategy: Total units MINUS weeks that block availability
      // 
      // BLOCKS availability:
      // - ASSIGNED: Owner has the week (might use it, not released yet)
      // - RESERVED: Owner confirmed they'll use it
      // - BOOKED: Someone booked it from marketplace
      // - Hotel bookings in v2_bookings
      //
      // DOESN'T block:
      // - RELEASED: Converted to credits, available to book
      // - EXPIRED/USED: Past, irrelevant
      
      // Count weeks that BLOCK availability
      const blockedTimeshareWeeks = await WeekAllocation.count({
        where: {
          status: {
            [Op.in]: ['ASSIGNED', 'RESERVED', 'BOOKED'] // These block availability
          },
          // Date overlap: end_date > checkInDate AND start_date < checkOutDate
          end_date: { [Op.gt]: checkInDate },
          start_date: { [Op.lt]: checkOutDate }
        },
        include: [{
          model: Ownership,
          as: 'ownership',
          where: { 
            unit_id: unit.id,
            status: { [Op.ne]: 'CANCELLED' } // Exclude cancelled ownerships
          },
          required: true
        }]
      });
      
      // Count RELEASED weeks for display purposes
      const releasedTimeshareWeeks = await WeekAllocation.count({
        where: {
          status: 'RELEASED',
          end_date: { [Op.gt]: checkInDate },
          start_date: { [Op.lt]: checkOutDate }
        },
        include: [{
          model: Ownership,
          as: 'ownership',
          where: { 
            unit_id: unit.id,
            status: { [Op.ne]: 'CANCELLED' } // Exclude cancelled ownerships
          },
          required: true
        }]
      });
      
      // Total occupied = hotel bookings + blocked timeshare weeks
      const totalOccupied = hotelBookings + blockedTimeshareWeeks;
      
      // Available = total units - occupied
      const finalAvailableUnits = Math.max(0, totalUnits - totalOccupied);
      
      console.log('📊 Availability calculation:', {
        category: unit.category,
        totalUnits,
        hotelBookings,
        blockedTimeshareWeeks,
        releasedTimeshareWeeks,
        totalOccupied,
        finalAvailableUnits
      });

      // Apply platform commission to price
      const basePrice = unit.base_credit_value || 0;
      const guestPrice = await pricingService.calculateGuestPrice(basePrice);
      const priceBreakdown = await pricingService.getPriceBreakdown(basePrice);

      return {
        unitId: unit.id,
        unitName: unit.category || unit.name || `Unit ${unit.id}`,
        totalUnits: totalUnits,
        bookedUnits: totalOccupied,
        availableUnits: finalAvailableUnits,
        releasedWeeks: releasedTimeshareWeeks,
        available: finalAvailableUnits > 0,
        price: guestPrice,
        basePrice: basePrice,
        rate: basePrice,
        pricing: {
          guestPrice,
          breakdown: priceBreakdown
        },
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
 * Get list of cities with available properties
 */
router.get('/cities', async (req: Request, res: Response) => {
  try {
    // Query unique cities from database
    const properties = await TimeshareProperty.findAll({
      where: { is_active: true },
      attributes: ['city', 'country'],
      group: ['city', 'country']
    });
    
    // Count properties per city
    const citiesData = await Promise.all(
      properties.map(async (p: any) => {
        const count = await TimeshareProperty.count({
          where: {
            city: p.city,
            country: p.country,
            is_active: true
          }
        });

        return {
          city: p.city,
          country: p.country,
          count
        };
      })
    );

    res.json({
      success: true,
      count: citiesData.length,
      data: citiesData.sort((a, b) => a.city.localeCompare(b.city)),
      source: 'database'
    });
  } catch (error) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cities'
    });
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

/**
 * POST /api/marketplace/properties/:propertyId/room-types/:roomType/create-payment-intent
 * Create Stripe payment intent for marketplace booking
 */
router.post('/properties/:propertyId/room-types/:roomType/create-payment-intent', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomType } = req.params;
    const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests, amount } = req.body;

    console.log('🔍 Create payment intent request:', { propertyId, roomType, guestName, guestEmail, checkIn, checkOut, guests, amount });

    // Validar campos requeridos
    if (!guestName || !guestEmail || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: guestName, guestEmail, checkIn, checkOut'
      });
    }

    // Verificar property en v2
    const property = await TimeshareProperty.findOne({
      where: { id: propertyId, is_active: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Buscar unit por categoría
    const unit = await TimeshareUnit.findOne({
      where: {
        property_id: propertyId,
        category: decodeURIComponent(roomType),
        is_active: true
      }
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        error: 'Room type not found'
      });
    }

    // Calcular precio (si no se provee un monto específico)
    let subtotal: number;
    let nights: number;
    let pricePerNight: number;
    
    // Convertir fechas (necesarias para metadata de Stripe)
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    if (amount && amount > 0) {
      // Si se provee un amount (ej: pago híbrido con créditos), usarlo
      subtotal = amount;
      pricePerNight = subtotal / nights;
      console.log('💰 Using provided amount (hybrid payment):', { amount, subtotal, nights, pricePerNight });
    } else {
      // Calcular precio normal (pago solo con tarjeta)
      // Obtener precio del guest con comisión
      const basePrice = unit.base_credit_value || 0;
      pricePerNight = await pricingService.calculateGuestPrice(basePrice);

      if (!pricePerNight || pricePerNight <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Room price not configured. Please contact property owner.'
        });
      }

      subtotal = pricePerNight * nights;
      console.log('💰 Calculated payment (card only):', { basePrice, pricePerNight, nights, subtotal });
    }

    const totalAmount = Math.round(subtotal * 100); // Convert to cents for Stripe

    // Verify Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('❌ STRIPE_SECRET_KEY not configured');
      return res.status(500).json({
        success: false,
        error: 'Payment system not configured'
      });
    }

    console.log('🔑 Creating Stripe payment intent...');
    
    const paymentIntent = await stripe.paymentIntents.create({
      amount: totalAmount,
      currency: unit.currency?.toLowerCase() || 'eur',
      metadata: {
        propertyId: propertyId.toString(),
        propertyName: property.name,
        roomType: unit.category,
        guestName,
        guestEmail,
        checkIn: checkInDate.toISOString(),
        checkOut: checkOutDate.toISOString(),
        nights: nights.toString(),
        guests: guests?.toString() || '1'
      },
      description: `Booking at ${property.name} - ${unit.category}`
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: subtotal,
        currency: unit.currency || 'EUR',
        nights,
        pricePerNight
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating payment intent:', error);
    console.error('❌ Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create payment intent'
    });
  }
});

/**
 * POST /api/marketplace/properties/:propertyId/room-types/:roomType/calculate-credit-price
 * Calculate price in credits for marketplace booking (for owners with credit balance)
 */
router.post('/properties/:propertyId/room-types/:roomType/calculate-credit-price', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomType } = req.params;
    const { checkIn, checkOut, guests } = req.body;

    console.log('🔍 Calculate credit price request:', { propertyId, roomType, checkIn, checkOut, guests });

    // Validar campos requeridos
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: checkIn, checkOut'
      });
    }

    // Verificar property en v2
    const property = await TimeshareProperty.findOne({
      where: { id: propertyId, is_active: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Buscar unit por categoría
    const unit = await TimeshareUnit.findOne({
      where: {
        property_id: propertyId,
        category: decodeURIComponent(roomType),
        is_active: true
      }
    });

    if (!unit) {
      return res.status(404).json({
        success: false,
        error: 'Room type not found'
      });
    }

    // Calcular noches
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Obtener configuración de créditos y servicio de cálculo
    const creditCalculationService = require('../services/CreditCalculationService').default;
    const { CreditCalculationService } = require('../services/CreditCalculationService');
    const creditToEurRate = await CreditCalculationService.getCreditToEurRate();

    // Helper: Determinar temporada por mes
    const getSeasonForMonth = (month: number): 'RED' | 'WHITE' | 'BLUE' => {
      if ([7, 8, 12].includes(month)) {
        return 'RED'; // Julio, Agosto, Diciembre (alta temporada)
      } else if ([1, 2, 6, 9].includes(month)) {
        return 'WHITE'; // Enero, Febrero, Junio, Septiembre (media)
      } else {
        return 'BLUE'; // Resto del año (baja)
      }
    };

    // Calcular créditos por noche, considerando cambios de temporada
    let totalCredits = 0;
    const nightlyBreakdown: Array<{
      date: string;
      season: string;
      credits: number;
    }> = [];

    // Iterar cada noche para calcular su costo según su temporada
    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(checkInDate);
      currentDate.setDate(currentDate.getDate() + i);
      const currentMonth = currentDate.getMonth() + 1;
      const seasonType = getSeasonForMonth(currentMonth);

      // Calcular costo para esta noche específica
      const nightCost = await creditCalculationService.calculateBookingCost(
        propertyId,
        decodeURIComponent(roomType),
        seasonType,
        1, // Solo 1 noche a la vez
        currentDate
      );

      totalCredits += nightCost.creditsPerNight;
      nightlyBreakdown.push({
        date: currentDate.toISOString().split('T')[0],
        season: seasonType,
        credits: nightCost.creditsPerNight
      });
    }

    const creditsRequired = totalCredits;
    const averageCreditsPerNight = Math.round(totalCredits / nights);

    // Convertir créditos a EUR para mostrar precio equivalente
    const totalEur = creditsRequired * creditToEurRate;
    const pricePerNightEur = averageCreditsPerNight * creditToEurRate;

    // Determinar si hay temporadas mixtas
    const uniqueSeasons = [...new Set(nightlyBreakdown.map(n => n.season))];
    const hasMixedSeasons = uniqueSeasons.length > 1;

    console.log('💰 Credit calculation (Master Formula with multi-season support):', {
      nights,
      creditsRequired,
      averageCreditsPerNight,
      totalEur,
      creditToEurRate,
      hasMixedSeasons,
      seasons: uniqueSeasons.join(', '),
      nightlyBreakdown
    });

    res.json({
      success: true,
      data: {
        creditsRequired,
        totalEur,
        pricePerNightEur,
        pricePerNightCredits: averageCreditsPerNight,
        nights,
        creditToEurRate,
        hasMixedSeasons,
        seasons: uniqueSeasons,
        nightlyBreakdown, // Detalle por noche
        currency: unit.currency || 'EUR'
      }
    });
  } catch (error: any) {
    console.error('❌ Error calculating credit price:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to calculate credit price'
    });
  }
});

/**
 * GET /api/marketplace/credits/balance/:userId
 * Get user's credit balance
 */
router.get('/credits/balance/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const CreditAccount = require('../models/v2/CreditAccount').default;
    const creditAccount = await CreditAccount.findOne({
      where: { user_id: userId }
    });

    if (!creditAccount) {
      return res.json({
        success: true,
        data: {
          balance: 0,
          hasAccount: false
        }
      });
    }

    res.json({
      success: true,
      data: {
        balance: creditAccount.balance,
        hasAccount: true,
        lastUpdated: creditAccount.balance_last_updated
      }
    });
  } catch (error: any) {
    console.error('❌ Error getting credit balance:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to get credit balance'
    });
  }
});

/**
 * POST /api/marketplace/bookings/with-credits
 * Create a booking using credits (full or partial payment)
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
      paymentIntentId // Optional - only if hybrid payment (credits + card)
    } = req.body;

    console.log('🔍 Creating booking with credits:', { 
      propertyId, roomType, checkIn, checkOut, guestEmail, userId, creditsToUse, paymentIntentId 
    });

    // Validar fechas y calcular noches
    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Check-in and check-out dates are required'
      });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    console.log('🔍 Creating booking with credits:', { 
      propertyId, roomType, guestEmail, userId, creditsToUse, paymentIntentId, nights 
    });

    // userId is required for credit payments
    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID required for credit payments'
      });
    }

    // Find property and unit
    const property = await TimeshareProperty.findByPk(propertyId);
    const unit = await TimeshareUnit.findOne({
      where: {
        property_id: propertyId,
        category: decodeURIComponent(roomType)
      }
    });

    if (!property || !unit) {
      return res.status(404).json({
        success: false,
        error: 'Property or room type not found'
      });
    }

    // Get credit account
    const CreditAccount = require('../models/v2/CreditAccount').default;
    const creditAccount = await CreditAccount.findOne({
      where: { user_id: userId }
    });

    if (!creditAccount) {
      return res.status(404).json({
        success: false,
        error: 'Credit account not found'
      });
    }

    // Check if user has enough credits
    if (creditAccount.balance < creditsToUse) {
      return res.status(400).json({
        success: false,
        error: `Insufficient credits. Available: ${creditAccount.balance}, Required: ${creditsToUse}`
      });
    }

    // Calculate pricing using Master Formula with multi-season support
    const creditCalculationService = require('../services/CreditCalculationService').default;
    const { CreditCalculationService } = require('../services/CreditCalculationService');
    const creditToEurRate = await CreditCalculationService.getCreditToEurRate();
    
    // Helper: Determinar temporada por mes
    const getSeasonForMonth = (month: number): 'RED' | 'WHITE' | 'BLUE' => {
      if ([7, 8, 12].includes(month)) {
        return 'RED'; // Alta temporada
      } else if ([1, 2, 6, 9].includes(month)) {
        return 'WHITE'; // Media temporada
      } else {
        return 'BLUE'; // Baja temporada
      }
    };

    // Calcular créditos totales considerando cambios de temporada
    const checkInDateObj = new Date(checkIn);
    let totalCreditsRequired = 0;
    const nightlyBreakdown: Array<{ date: string; season: string; credits: number }> = [];

    for (let i = 0; i < nights; i++) {
      const currentDate = new Date(checkInDateObj);
      currentDate.setDate(currentDate.getDate() + i);
      const currentMonth = currentDate.getMonth() + 1;
      const seasonType = getSeasonForMonth(currentMonth);

      const nightCost = await creditCalculationService.calculateBookingCost(
        propertyId,
        decodeURIComponent(roomType),
        seasonType,
        1,
        currentDate
      );

      totalCreditsRequired += nightCost.creditsPerNight;
      nightlyBreakdown.push({
        date: currentDate.toISOString().split('T')[0],
        season: seasonType,
        credits: nightCost.creditsPerNight
      });
    }

    const creditsRequired = totalCreditsRequired;
    const totalEur = creditsRequired * creditToEurRate;
    const creditsValueEur = creditsToUse * creditToEurRate;
    const cashNeeded = Math.max(0, totalEur - creditsValueEur);

    const uniqueSeasons = [...new Set(nightlyBreakdown.map(n => n.season))];

    console.log('💰 Payment breakdown (Master Formula with multi-season):', {
      nights,
      creditsRequired,
      creditsToUse,
      totalEur,
      creditsValueEur,
      cashNeeded,
      creditToEurRate,
      seasons: uniqueSeasons.join(', '),
      nightlyBreakdown
    });

    // If hybrid payment, verify payment intent
    if (cashNeeded > 0) {
      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: `Cash payment required: €${cashNeeded.toFixed(2)}`
        });
      }

      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      if (paymentIntent.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          error: 'Payment not confirmed'
        });
      }

      // Verify payment amount matches
      const paidAmount = paymentIntent.amount / 100; // Convert from cents
      if (Math.abs(paidAmount - cashNeeded) > 0.01) {
        return res.status(400).json({
          success: false,
          error: `Payment amount mismatch. Expected: €${cashNeeded.toFixed(2)}, Paid: €${paidAmount.toFixed(2)}`
        });
      }
    }

    // Deduct credits from account
    const CreditTransaction = require('../models/v2/CreditTransaction').default;
    const previousBalance = creditAccount.balance;
    const newBalance = previousBalance - creditsToUse;

    await creditAccount.update({
      balance: newBalance,
      balance_last_updated: new Date()
    });

    // Generate booking code
    const bookingCode = `MKT${Date.now()}${Math.floor(Math.random() * 1000)}`;

    // Create credit transaction record
    const transactionDescription = `Marketplace booking at ${property.name} - ${unit.category}`;
    
    const creditTransaction = await CreditTransaction.create({
      account_id: creditAccount.id, // Corregido: era credit_account_id
      type: 'WEEK_BOOKING',
      amount: -creditsToUse,
      balance_before: previousBalance,
      balance_after: newBalance,
      description: transactionDescription,
      reference_type: 'marketplace_booking',
      reference_id: null, // Will be updated after booking is created
      metadata: {
        propertyId,
        propertyName: property.name,
        roomType: unit.category,
        checkIn,
        checkOut,
        nights,
        totalEur,
        creditsUsed: creditsToUse,
        cashPaid: cashNeeded,
        paymentIntentId: paymentIntentId || null
      }
    });

    // Calculate platform revenue (commission)
    const commissionRate = await pricingService.getPlatformCommissionRate();
    const baseBookingPrice = totalEur / (1 + commissionRate / 100);
    const platformRevenue = totalEur - baseBookingPrice;

    // Create booking in v2_bookings table
    const booking = await V2Booking.create({
      booking_code: bookingCode,
      property_id: propertyId,
      unit_id: unit.id,
      guest_id: userId,
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      check_in: new Date(checkIn),
      check_out: new Date(checkOut),
      nights: nights,
      number_of_guests: guests || 1,
      num_guests: guests || 1,
      room_category: unit.category,
      total_amount: totalEur,
      currency: 'EUR',
      payment_method: cashNeeded > 0 ? 'hybrid' : 'credits',
      payment_status: 'PAID',
      payment_intent_id: paymentIntentId || null,
      booking_status: 'CONFIRMED',
      booked_via: 'MARKETPLACE',
      source: 'HOTEL_PMS',
      credits_used: creditsToUse,
      cash_paid: cashNeeded,
      platform_cost: 0,
      platform_revenue: parseFloat(platformRevenue.toFixed(2)),
      margin_percent: parseFloat(commissionRate.toFixed(2)),
      status: 'CONFIRMED'
    });

    console.log('✅ Booking created with credits:', booking.id, `User ${userId}, Credits: ${creditsToUse}, Cash: €${cashNeeded}`);

    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        confirmationNumber: bookingCode,
        property: property.name,
        roomType: unit.category,
        checkIn,
        checkOut,
        guests,
        totalAmount: totalEur,
        creditsUsed: creditsToUse,
        cashPaid: cashNeeded,
        currency: 'EUR',
        newCreditBalance: newBalance
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating booking with credits:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create booking with credits'
    });
  }
});

/**
 * POST /api/marketplace/bookings
 * Create a booking record after successful payment (card only)
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
      nights
    } = req.body;

    console.log('🔍 Creating booking:', { propertyId, roomType, guestEmail, userId, paymentIntentId });

    // Verify payment intent with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({
        success: false,
        error: 'Payment not confirmed'
      });
    }

    // Find property and unit
    const property = await TimeshareProperty.findByPk(propertyId);
    const unit = await TimeshareUnit.findOne({
      where: {
        property_id: propertyId,
        category: decodeURIComponent(roomType)
      }
    });

    if (!property || !unit) {
      return res.status(404).json({
        success: false,
        error: 'Property or room type not found'
      });
    }

    // Create booking in v2_bookings table
    const bookingCode = `BK${Date.now()}${Math.floor(Math.random() * 1000)}`;
    
    // Calculate platform revenue (commission)
    const commissionRate = await pricingService.getPlatformCommissionRate();
    const basePrice = totalAmount / (1 + commissionRate / 100);
    const platformRevenue = totalAmount - basePrice;
    
    const booking = await V2Booking.create({
      booking_code: bookingCode,
      property_id: propertyId,
      unit_id: unit.id,
      guest_id: userId || null, // Use userId if provided (logged in), null for guest checkout
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      check_in: new Date(checkIn),
      check_out: new Date(checkOut),
      nights: nights,
      number_of_guests: guests || 1,
      num_guests: guests || 1,
      room_category: unit.category,
      total_amount: totalAmount,
      currency: currency || 'EUR',
      payment_method: 'stripe',
      payment_status: 'PAID',
      payment_intent_id: paymentIntentId,
      booking_status: 'CONFIRMED',
      booked_via: 'MARKETPLACE',
      source: 'HOTEL_PMS', // Use HOTEL_PMS for marketplace bookings
      credits_used: 0,
      cash_paid: totalAmount,
      platform_cost: 0,
      platform_revenue: parseFloat(platformRevenue.toFixed(2)),
      margin_percent: parseFloat(commissionRate.toFixed(2)),
      status: 'CONFIRMED'
    });

    console.log('✅ Booking created:', booking.id, userId ? `for user ${userId}` : '(guest checkout)');

    res.json({
      success: true,
      data: {
        bookingId: booking.id,
        confirmationNumber: bookingCode,
        property: property.name,
        roomType: unit.category,
        checkIn,
        checkOut,
        guests,
        totalAmount,
        currency
      }
    });
  } catch (error: any) {
    console.error('❌ Error creating booking:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create booking'
    });
  }
});

export default router;
