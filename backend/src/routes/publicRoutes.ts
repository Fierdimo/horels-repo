import { Router, Request, Response } from 'express';
import { Property, Week, User, Room, Booking, Role } from '../models';
import PlatformSetting from '../models/PlatformSetting';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/authMiddleware';
import { PMSFactory } from '../services/pms/PMSFactory';
import { decryptPMSCredentials } from '../utils/pmsEncryption';
import pricingService from '../services/pricingService';
import bookingStatusService from '../services/bookingStatusService';
import { StripeService } from '../services/stripeService';
import RoomEnrichmentService from '../services/roomEnrichmentService';
import jwt from 'jsonwebtoken';
import UserCreditWallet from '../models/UserCreditWallet';
import CreditTransaction from '../models/CreditTransaction';
import CreditCalculationService from '../services/CreditCalculationService';
import { CreditCalculationService as CreditCalculationServiceClass } from '../services/CreditCalculationService';
import SeasonalCalendar from '../models/SeasonalCalendar';
import sequelize from '../config/database';

const router = Router();
const stripeService = new StripeService();

/**
 * @route   GET /api/public/properties
 * @desc    Get list of active properties (marketplace)
 * @access  Public
 */
router.get('/properties', async (req: Request, res: Response) => {
  try {
    const { city, country, stars, search } = req.query;
    
    const where: any = {
      is_marketplace_enabled: true, // Solo mostrar properties habilitadas en marketplace
      is_active: true // Solo activas
    };

    // Filtros opcionales
    if (city) where.city = city;
    if (country) where.country = country;
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } }
      ];
    }

    const properties = await Property.findAll({
      where,
      attributes: [
        'id', 'name', 'city', 'country',
        'pms_provider',
        'description', 'images', 'amenities',
      ],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: properties,
      count: properties.length
    });
  } catch (error: any) {
    console.error('Error fetching public properties:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/properties/:id
 * @desc    Get property details for marketplace
 * @access  Public
 */
router.get('/properties/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const property = await Property.findOne({
      where: {
        id,
        is_active: true
      },
      attributes: {
        exclude: ['pms_credentials', 'pms_credentials_encrypted', 'bank_account_info', 'stripe_connect_account_id']
      }
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
    console.error('Error fetching property details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch property',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/properties/:id/availability
 * @desc    Check availability for a property (dates)
 * @access  Public (guests can check before booking)
 */
router.get('/properties/:id/availability', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { start_date, end_date, room_type } = req.query;

    const property = await Property.findOne({
      where: { id, is_active: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Validar fechas
    if (!start_date || !end_date) {
      return res.status(400).json({
        success: false,
        error: 'start_date and end_date are required'
      });
    }

    const startDate = new Date(start_date as string);
    const endDate = new Date(end_date as string);

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'end_date must be after start_date'
      });
    }

    // Si tiene PMS, consultar disponibilidad en tiempo real
    if (property.pms_provider && property.pms_credentials_encrypted) {
      try {
        const credentials = decryptPMSCredentials(property.pms_credentials_encrypted.toString('utf8'));
        const adapter = PMSFactory.create(property.pms_provider as any, credentials as any);

        // Consultar disponibilidad en PMS
        const pmsAvailability = await adapter.getAvailability({
          checkIn: startDate,
          checkOut: endDate
        });

        // Apply platform commission to all room prices
        const pricingService = require('../services/pricingService').default;
        const detailsWithPricing = await Promise.all(
          pmsAvailability.map(async (room: any) => {
            const hotelPrice = room.rate || 0;
            const guestPrice = await pricingService.calculateGuestPrice(hotelPrice);
            const priceBreakdown = await pricingService.getPriceBreakdown(hotelPrice);
            
            return {
              ...room,
              price: guestPrice, // Replace hotel price with guest price
              basePrice: hotelPrice, // Keep original for reference
              pricing: {
                guestPrice,
                breakdown: priceBreakdown
              }
            };
          })
        );

        // getAvailability returns PMSRoomAvailability[]
        const hasAvailability = detailsWithPricing && detailsWithPricing.length > 0 &&
                               detailsWithPricing.some(room => room.availableRooms > 0);

        return res.json({
          success: true,
          data: {
            available: hasAvailability,
            source: 'pms',
            pms_provider: property.pms_provider,
            details: detailsWithPricing
          }
        });
      } catch (error: any) {
        console.error('Error checking PMS availability:', error);
        // Continuar con verificación local si falla PMS
      }
    }

    // Si no tiene PMS o falla la consulta, verificar disponibilidad local
    // Buscar habitaciones habilitadas en marketplace
    const whereRooms: any = {
      propertyId: property.id,
      isMarketplaceEnabled: true,
      is_active: true
    };

    if (room_type) {
      whereRooms.type = room_type;
    }

    const availableRooms = await Room.findAll({
      where: whereRooms
    });

    if (availableRooms.length === 0) {
      return res.json({
        success: true,
        data: {
          available: false,
          reason: 'No rooms available for the selected dates',
          source: 'local'
        }
      });
    }

    // Verificar qué habitaciones están ocupadas en las fechas solicitadas
    const occupiedRoomIds = await Booking.findAll({
      where: {
        property_id: property.id,
        status: { [Op.in]: ['confirmed', 'checked_in'] },
        room_id: { [Op.ne]: null }, // Solo bookings con habitación asignada
        [Op.or]: [
          {
            check_in: {
              [Op.between]: [startDate, endDate]
            }
          },
          {
            check_out: {
              [Op.between]: [startDate, endDate]
            }
          },
          {
            [Op.and]: [
              { check_in: { [Op.lte]: startDate } },
              { check_out: { [Op.gte]: endDate } }
            ]
          }
        ]
      },
      attributes: ['room_id'],
      group: ['room_id']
    });

    const occupiedIds = occupiedRoomIds.map((b: any) => b.room_id).filter(Boolean);

    // Filtrar habitaciones disponibles (no ocupadas)
    const actuallyAvailableRooms = availableRooms.filter(
      (room: Room) => !occupiedIds.includes(room.id)
    );

    res.json({
      success: true,
      data: {
        available: actuallyAvailableRooms.length > 0,
        totalRooms: availableRooms.length,
        occupiedRooms: occupiedIds.length,
        availableRooms: actuallyAvailableRooms.length,
        availableRoomIds: actuallyAvailableRooms.map((r: Room) => r.id),
        source: 'local'
      }
    });
  } catch (error: any) {
    console.error('Error checking availability:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/properties/:id/rooms
 * @desc    Get available rooms for a property (marketplace)
 * @access  Public
 */
router.get('/properties/:id/rooms', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { type, min_capacity, max_price, checkIn, checkOut } = req.query;

    const property = await Property.findOne({
      where: { id, is_active: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Solo mostrar habitaciones habilitadas en marketplace
    const where: any = {
      propertyId: property.id,
      isMarketplaceEnabled: true
    };

    const rooms = await Room.findAll({
      where,
      order: [['pmsResourceId', 'ASC']]
    });

    if (rooms.length === 0) {
      return res.json({
        success: true,
        data: [],
        count: 0
      });
    }

    // Filtrar habitaciones ocupadas si se proporcionan fechas
    let availableRooms = rooms;
    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn as string);
      const checkOutDate = new Date(checkOut as string);
      
      availableRooms = [];
      for (const room of rooms) {
        const isAvailable = await bookingStatusService.checkRoomAvailability(
          room.id,
          checkInDate,
          checkOutDate
        );
        if (isAvailable) {
          availableRooms.push(room);
        }
      }
    }

    // Enriquecer habitaciones con datos del PMS
    let enrichedRooms = await RoomEnrichmentService.enrichRooms(availableRooms);

    // Aplicar filtro de tipo y capacidad después del enriquecimiento
    if (type) {
      enrichedRooms = enrichedRooms.filter((room: any) => room.type === type);
    }
    if (min_capacity) {
      const minCapNum = parseInt(min_capacity as string);
      enrichedRooms = enrichedRooms.filter((room: any) => (room.capacity || 0) >= minCapNum);
    }

    // Aplicar filtro de precio
    let filteredRooms = enrichedRooms;
    if (max_price) {
      const maxPriceNum = parseFloat(max_price as string);
      filteredRooms = enrichedRooms.filter((room: any) => {
        const effectivePrice = room.price || 0;
        return effectivePrice <= maxPriceNum;
      });
    }

    // Agregar precio efectivo con comisión de plataforma a cada habitación
    const roomsWithPrice = await Promise.all(
      filteredRooms.map(async (room: any) => {
        const hotelPrice = room.price || 0;
        const guestPrice = await pricingService.calculateGuestPrice(hotelPrice);
        const commissionRate = await pricingService.getPlatformCommissionRate();

        return {
          id: room.id,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          floor: room.floor,
          description: room.description,
          amenities: room.amenities,
          images: [], // images field doesn't exist in current schema
          hotelPrice: hotelPrice, // Precio del hotel
          guestPrice, // Precio final que pagará el guest
          platformCommission: parseFloat((guestPrice - hotelPrice).toFixed(2)),
          commissionRate // Porcentaje de comisión
        };
      })
    );

    res.json({
      success: true,
      data: roomsWithPrice,
      count: roomsWithPrice.length
    });
  } catch (error: any) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rooms',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/properties/:propertyId/room-types/:roomType
 * @desc    Get room type details from PMS
 * @access  Public
 */
router.get('/properties/:propertyId/room-types/:roomType', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomType } = req.params;
    const { checkIn, checkOut } = req.query;

    console.log('[GET room-type] Request:', { propertyId, roomType, checkIn, checkOut });

    const property = await Property.findByPk(propertyId);
    if (!property) {
      console.error('[GET room-type] Property not found:', propertyId);
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    console.log('[GET room-type] Property found:', { 
      id: property.id, 
      name: property.name,
      pms_provider: property.pms_provider,
      has_credentials: !!property.pms_credentials_encrypted
    });

    // Obtener datos del tipo de habitación desde el PMS
    let roomTypeData = null;
    
    if (property.pms_provider && property.pms_credentials_encrypted && checkIn && checkOut) {
      try {
        console.log('[GET room-type] Fetching from PMS...');
        const credentials = decryptPMSCredentials(property.pms_credentials_encrypted.toString('utf8'));
        const adapter = PMSFactory.create(property.pms_provider as any, credentials as any);

        const pmsAvailability = await adapter.getAvailability({
          checkIn: new Date(checkIn as string),
          checkOut: new Date(checkOut as string),
          roomCategory: decodeURIComponent(roomType)
        });

        console.log('[GET room-type] PMS availability response:', pmsAvailability);

        // Buscar el tipo específico en la respuesta del PMS
        roomTypeData = pmsAvailability.find(
          (room: any) => room.roomCategory === decodeURIComponent(roomType)
        );

        console.log('[GET room-type] Room type data found:', roomTypeData);
      } catch (error: any) {
        console.error('[GET room-type] Error fetching from PMS:', error.message);
        console.error('[GET room-type] Error stack:', error.stack);
      }
    } else {
      console.log('[GET room-type] Skipping PMS query:', {
        hasPMS: !!property.pms_provider,
        pmsProvider: property.pms_provider,
        hasCredentials: !!property.pms_credentials_encrypted,
        hasCheckIn: !!checkIn,
        hasCheckOut: !!checkOut
      });
    }

    // Si no se encontró en PMS, devolver datos genéricos
    if (!roomTypeData) {
      console.log('[GET room-type] No PMS data, returning generic data');
      const hotelPrice = 0;
      const guestPrice = await pricingService.calculateGuestPrice(hotelPrice);
      const priceBreakdown = await pricingService.getPriceBreakdown(hotelPrice);

      return res.json({
        success: true,
        data: {
          roomType: decodeURIComponent(roomType),
          name: decodeURIComponent(roomType),
          description: 'Standard room',
          capacity: 2,
          basePrice: 0,
          pricing: {
            guestPrice,
            breakdown: priceBreakdown
          },
          property: {
            id: property.id,
            name: property.name,
            location: `${property.city}, ${property.country}`
          }
        }
      });
    }

    // Devolver datos del PMS
    console.log('[GET room-type] Calculating pricing for hotel price:', roomTypeData.rate);
    const hotelPrice = roomTypeData.rate || 0;
    const guestPrice = await pricingService.calculateGuestPrice(hotelPrice);
    const priceBreakdown = await pricingService.getPriceBreakdown(hotelPrice);

    console.log('[GET room-type] Returning successful response');
    res.json({
      success: true,
      data: {
        roomType: roomTypeData.roomCategory,
        name: roomTypeData.roomCategory,
        description: roomTypeData.description || roomTypeData.roomCategory,
        capacity: roomTypeData.capacity || 2,
        basePrice: roomTypeData.rate,
        amenities: roomTypeData.amenities || [],
        images: roomTypeData.images || [],
        availableRooms: roomTypeData.availableRooms || 0,
        pricing: {
          guestPrice,
          breakdown: priceBreakdown
        },
        property: {
          id: property.id,
          name: property.name,
          location: `${property.city}, ${property.country}`
        }
      }
    });
  } catch (error: any) {
    console.error('[GET room-type] Unhandled error:', error.message);
    console.error('[GET room-type] Error stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch room',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/public/properties/:propertyId/room-types/:roomType/create-payment-intent
 * @desc    Create a Stripe payment intent for marketplace booking (by room type)
 * @access  Public
 */
router.post('/properties/:propertyId/room-types/:roomType/create-payment-intent', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomType } = req.params;
    const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests } = req.body;

    // Validar campos requeridos
    if (!guestName || !guestEmail || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: guestName, guestEmail, checkIn, checkOut'
      });
    }

    // Verificar property
    const property = await Property.findOne({
      where: { id: propertyId, is_active: true, is_marketplace_enabled: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Verificar que la propiedad tenga PMS configurado
    if (!property.pms_provider || !property.pms_credentials_encrypted) {
      return res.status(400).json({
        success: false,
        error: 'Property does not have PMS configured'
      });
    }

    // Obtener datos del room type desde PMS
    const adapter = PMSFactory.create(property.pms_provider as any, decryptPMSCredentials(property.pms_credentials_encrypted.toString('utf8')) as any);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    const pmsAvailability = await adapter.getAvailability({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      roomCategory: decodeURIComponent(roomType)
    });

    const roomTypeData = pmsAvailability.find(r => r.roomCategory === decodeURIComponent(roomType));
    
    if (!roomTypeData || !roomTypeData.availableRooms || roomTypeData.availableRooms <= 0) {
      return res.status(404).json({
        success: false,
        error: 'Room type not available for selected dates'
      });
    }

    // Calcular precio
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Obtener precio del guest usando pricingService
    const hotelPrice = roomTypeData.rate || 0;
    const pricePerNight = await pricingService.calculateGuestPrice(hotelPrice);

    if (!pricePerNight || pricePerNight <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Room price not configured. Please contact property owner.'
      });
    }

    const subtotal = pricePerNight * nights;

    // Obtener platform fee percentage de la base de datos
    let platformFeePercentage = 10; // Default 10%
    try {
      const setting = await PlatformSetting.findOne({
        where: { setting_key: 'commissionRate' }
      });
      if (setting) {
        platformFeePercentage = parseFloat((setting as any).setting_value);
      }
    } catch (error) {
      console.warn('Could not fetch commission rate, using default 10%');
    }

    // Calcular platform fee y total
    const platformFeeAmount = Math.round((subtotal * platformFeePercentage) / 100 * 100) / 100;
    const totalAmount = Math.round((subtotal + platformFeeAmount) * 100) / 100;

    // Validar que el monto cumple con el mínimo de Stripe (0.50 EUR = 50 centavos)
    if (totalAmount < 0.50) {
      return res.status(400).json({
        success: false,
        error: 'Total amount is below minimum charge amount (€0.50)'
      });
    }

    // Crear Payment Intent con metadata
    const paymentIntent = await stripeService.createMarketplacePaymentIntent({
      propertyId: parseInt(propertyId),
      roomId: 0, // No room ID for room types
      roomName: roomTypeData.roomCategory,
      guestName,
      guestEmail,
      guestPhone,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalAmount,
      nights,
      pricePerNight,
      platformFeePercentage,
      platformFeeAmount,
      subtotal
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount,
        subtotal: subtotal,
        platformFeeAmount: platformFeeAmount,
        platformFeePercentage: platformFeePercentage,
        isTestPrice: false
      }
    });

  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/public/properties/:propertyId/room-types/:roomType/book-with-credits
 * @desc    Book room type using credits only (no card payment)
 * @access  Public (requires authentication via token)
 */
router.post('/properties/:propertyId/room-types/:roomType/book-with-credits', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomType } = req.params;
    const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests } = req.body;

    // Get user from token (should be set by authenticateToken middleware if present)
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required for credit payments'
      });
    }

    // Verificar property
    const property = await Property.findOne({
      where: { id: propertyId, is_active: true, is_marketplace_enabled: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Verificar que la propiedad tenga PMS configurado
    if (!property.pms_provider || !property.pms_credentials_encrypted) {
      return res.status(400).json({
        success: false,
        error: 'Property does not have PMS configured'
      });
    }

    // Obtener datos del room type desde PMS
    const adapter = PMSFactory.create(property.pms_provider as any, decryptPMSCredentials(property.pms_credentials_encrypted.toString('utf8')) as any);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    const pmsAvailability = await adapter.getAvailability({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      roomCategory: decodeURIComponent(roomType)
    });

    const roomTypeData = pmsAvailability.find(r => r.roomCategory === decodeURIComponent(roomType));
    
    if (!roomTypeData || !roomTypeData.availableRooms || roomTypeData.availableRooms <= 0) {
      return res.status(404).json({
        success: false,
        error: 'Room type not available for selected dates'
      });
    }

    // TODO: Implement credit-based booking logic
    // This would involve:
    // 1. Calculate credit cost
    // 2. Verify user has sufficient credits
    // 3. Deduct credits
    // 4. Create PMS booking
    // 5. Create local booking record

    return res.status(501).json({
      success: false,
      error: 'Credit-based booking not yet implemented for room types'
    });

  } catch (error: any) {
    console.error('Error booking with credits:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/public/properties/:propertyId/room-types/:roomType/calculate-credit-cost
 * @desc    Calculate credit cost for booking a room type
 * @access  Public (requires authentication)
 */
router.post('/properties/:propertyId/room-types/:roomType/calculate-credit-cost', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomType } = req.params;
    const { checkIn, checkOut } = req.body;

    // Get user from token
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required'
      });
    }

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'checkIn and checkOut dates are required'
      });
    }

    // Verificar property
    const property = await Property.findOne({
      where: { id: propertyId, is_active: true, is_marketplace_enabled: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Verificar que la propiedad tenga PMS configurado
    if (!property.pms_provider || !property.pms_credentials_encrypted) {
      return res.status(400).json({
        success: false,
        error: 'Property does not have PMS configured'
      });
    }

    // Obtener datos del room type desde PMS
    const adapter = PMSFactory.create(property.pms_provider as any, decryptPMSCredentials(property.pms_credentials_encrypted.toString('utf8')) as any);
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    
    const pmsAvailability = await adapter.getAvailability({
      checkIn: checkInDate,
      checkOut: checkOutDate,
      roomCategory: decodeURIComponent(roomType)
    });

    const roomTypeData = pmsAvailability.find(r => r.roomCategory === decodeURIComponent(roomType));
    
    if (!roomTypeData) {
      return res.status(404).json({
        success: false,
        error: 'Room type not found'
      });
    }

    // Calculate credits using CreditCalculationService
    const hotelPrice = roomTypeData.rate || 0;
    
    // Calculate nights
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    
    // Determine season type from SeasonalCalendar (property-specific config with default fallback)
    const seasonType = await SeasonalCalendar.getSeasonForDateWithDefault(
      parseInt(propertyId),
      checkInDate
    );
    
    const creditService = new CreditCalculationServiceClass();
    const calculation = await creditService.calculateBookingCost(
      parseInt(propertyId),
      decodeURIComponent(roomType),
      seasonType,
      nights,
      checkInDate
    );
    
    // Get user wallet to check if they have enough credits
    const wallet = await UserCreditWallet.findOne({ where: { user_id: userId } });
    const availableCredits = wallet?.total_balance || 0;
    const hasEnoughCredits = availableCredits >= calculation.totalCredits;
    const deficit = hasEnoughCredits ? 0 : calculation.totalCredits - availableCredits;

    return res.json({
      success: true,
      data: {
        creditsRequired: calculation.totalCredits,
        creditsPerNight: calculation.creditsPerNight,
        totalAmountEUR: hotelPrice * nights,
        pricePerNightEUR: hotelPrice,
        nights,
        season: seasonType,
        roomType: decodeURIComponent(roomType),
        breakdown: calculation.breakdown,
        wallet: {
          availableCredits,
          hasEnoughCredits,
          deficit
        }
      }
    });

  } catch (error: any) {
    console.error('Error calculating credit cost:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/properties/:propertyId/products
 * @desc    Get available products/services for a property
 * @access  Public
 */
router.get('/properties/:propertyId/products', async (req: Request, res: Response) => {
  try {
    const { propertyId } = req.params;

    // Verificar que la propiedad existe y está habilitada en marketplace
    const property = await Property.findOne({
      where: {
        id: propertyId,
        is_marketplace_enabled: true,
        is_active: true
      }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    const productSyncService = require('../services/productSyncService').default;
    const services = await productSyncService.getActiveServices(parseInt(propertyId));

    res.json({
      success: true,
      data: services,
      count: services.length
    });
  } catch (error: any) {
    console.error('Error fetching products:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch products',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/weeks/available
 * @desc    Get available weeks for timeshare exchange (for owners)
 * @access  Authenticated (owner role)
 */
router.get('/weeks/available', authenticateToken, async (req: any, res: Response) => {
  try {
    const user = req.user;

    // Solo owners pueden ver weeks disponibles para swap
    const userRole = user.Role?.name || user.role;
    if (userRole !== 'owner' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Only owners can access timeshare weeks'
      });
    }

    const { property_id, start_date, end_date } = req.query;

    const where: any = {
      status: 'available',
      // Exclude floating periods from marketplace (only fixed-date periods can be swapped)
      start_date: { [Op.ne]: null },
      end_date: { [Op.ne]: null }
    };

    if (property_id) where.property_id = property_id;
    if (start_date) where.start_date = { [Op.and]: [{ [Op.ne]: null }, { [Op.gte]: new Date(start_date as string) }] };
    if (end_date) where.end_date = { [Op.and]: [{ [Op.ne]: null }, { [Op.lte]: new Date(end_date as string) }] };

    const weeks = await Week.findAll({
      where,
      include: [
        {
          association: 'Property',
          attributes: ['id', 'name', 'location', 'city', 'country', 'stars', 'images', 'amenities']
        },
        {
          association: 'Owner',
          attributes: ['id', 'email']
        }
      ],
      order: [['start_date', 'ASC']],
      limit: 50
    });

    res.json({
      success: true,
      data: weeks,
      count: weeks.length
    });
  } catch (error: any) {
    console.error('Error fetching available weeks:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch weeks',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/cities
 * @desc    Get list of cities with properties
 * @access  Public
 */
router.get('/cities', async (req: Request, res: Response) => {
  try {
    const cities = await Property.findAll({
      where: { is_active: true },
      attributes: ['city', 'country'],
      group: ['city', 'country'],
      raw: true
    });

    res.json({
      success: true,
      data: cities
    });
  } catch (error: any) {
    console.error('Error fetching cities:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch cities',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/public/properties/:propertyId/rooms/:roomId/book
 * @desc    Create a marketplace booking (pending staff approval)
 * @access  Public
 */
router.post('/properties/:propertyId/rooms/:roomId/book', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomId } = req.params;
    const { guest_name, guest_email, check_in, check_out, guest_phone } = req.body;

    // Validar campos requeridos
    if (!guest_name || !guest_email || !check_in || !check_out) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: guest_name, guest_email, check_in, check_out'
      });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid email format'
      });
    }

    // Validar fechas
    const checkInDate = new Date(check_in);
    const checkOutDate = new Date(check_out);
    const now = new Date();

    if (checkInDate >= checkOutDate) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    if (checkInDate < now) {
      return res.status(400).json({
        success: false,
        error: 'Check-in date cannot be in the past'
      });
    }

    // Verificar que la property exista y esté activa
    const property = await Property.findOne({
      where: { id: propertyId, is_active: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Verificar que la habitación exista
    // Note: propertyId and isMarketplaceEnabled fields don't exist in current schema
    const room = await Room.findOne({
      where: {
        id: roomId
      }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found or not available for marketplace booking'
      });
    }

    // Verificar disponibilidad en las fechas solicitadas
    const isAvailable = await bookingStatusService.checkRoomAvailability(
      parseInt(roomId),
      checkInDate,
      checkOutDate
    );

    if (!isAvailable) {
      return res.status(409).json({
        success: false,
        error: 'Room is not available for the selected dates'
      });
    }

    // Calcular precio total
    const nights = Math.ceil(
      (checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    const hotelPrice = 0; // customPrice field doesn't exist in current schema
    const guestPrice = await pricingService.calculateGuestPrice(hotelPrice);
    const totalAmount = guestPrice * nights;

    // Generar guest_token único
    const guest_token = `gt_marketplace_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Crear booking con estado 'pending' (requiere aprobación de staff)
    const booking = await Booking.create({
      property_id: property.id,
      room_id: room.id,
      guest_name,
      guest_email,
      check_in: checkInDate,
      check_out: checkOutDate,
      room_type: null, // roomTypeId field doesn't exist in current schema
      status: 'pending', // Estado inicial para aprobación de staff
      guest_token,
      total_amount: totalAmount,
      currency: 'EUR'
    });

    // Notificar al staff (esto se puede hacer mediante email, websocket, etc.)
    // TODO: Implementar notificación al staff de nueva reserva pendiente

    // Enriquecer room con datos del PMS para la respuesta
    let enrichedRoom;
    try {
      enrichedRoom = await RoomEnrichmentService.enrichRoom(room);
    } catch (error: any) {
      console.warn('Warning: Could not enrich room:', error.message);
      enrichedRoom = { name: `Room ${roomId}` } as any;
    }

    res.status(201).json({
      success: true,
      message: 'Booking created successfully. Awaiting staff approval.',
      data: {
        booking: {
          id: booking.id,
          property_id: booking.property_id,
          room_id: booking.room_id,
          guest_name: booking.guest_name,
          guest_email: booking.guest_email,
          check_in: booking.check_in,
          check_out: booking.check_out,
          status: booking.status,
          total_amount: booking.total_amount,
          currency: booking.currency,
          nights,
          price_per_night: guestPrice
        },
        room: {
          name: enrichedRoom.name,
          type: null // roomTypeId field doesn't exist in current schema
        },
        property: {
          name: property.name,
          location: `${property.city}, ${property.country}`
        }
      }
    });
  } catch (error: any) {
    console.error('Error creating marketplace booking:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/public/properties/:propertyId/rooms/:roomId/create-payment-intent
 * @desc    Create a Stripe payment intent for marketplace booking
 * @access  Public
 */
router.post('/properties/:propertyId/rooms/:roomId/create-payment-intent', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomId } = req.params;
    const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests } = req.body;

    // Validar campos requeridos
    if (!guestName || !guestEmail || !checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: guestName, guestEmail, checkIn, checkOut'
      });
    }

    // Verificar property
    const property = await Property.findOne({
      where: { id: propertyId, is_active: true, is_marketplace_enabled: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Verificar room
    // Note: propertyId and isMarketplaceEnabled fields don't exist in current schema
    const room = await Room.findOne({
      where: { 
        id: roomId
      }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found or not available'
      });
    }

    // Calcular precio
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));
    
    if (nights <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Check-out date must be after check-in date'
      });
    }

    // Determinar precio base
    let pricePerNight = 0; // customPrice field doesn't exist in current schema
    let isTestPrice = false;

    // En desarrollo/testing, si el precio es 0, usar precio de prueba
    if ((!pricePerNight || pricePerNight <= 0) && process.env.NODE_ENV !== 'production') {
      pricePerNight = 10.00; // 10 EUR por noche para pruebas
      isTestPrice = true;
      console.log(`⚠️  Using test price for room ${room.id}: €${pricePerNight}/night`);
    } else if (!pricePerNight || pricePerNight <= 0) {
      // En producción, rechazar si no hay precio
      return res.status(400).json({
        success: false,
        error: 'Room price not configured. Please contact property owner.'
      });
    }

    const subtotal = pricePerNight * nights;

    // Obtener platform fee percentage de la base de datos
    let platformFeePercentage = 10; // Default 10%
    try {
      const setting = await PlatformSetting.findOne({
        where: { setting_key: 'commissionRate' }
      });
      if (setting) {
        platformFeePercentage = parseFloat((setting as any).setting_value);
      }
    } catch (error) {
      console.warn('Could not fetch commission rate, using default 10%');
    }

    // Calcular platform fee y total
    const platformFeeAmount = Math.round((subtotal * platformFeePercentage) / 100 * 100) / 100;
    const totalAmount = Math.round((subtotal + platformFeeAmount) * 100) / 100;

    // Validar que el monto cumple con el mínimo de Stripe (0.50 EUR = 50 centavos)
    if (totalAmount < 0.50) {
      return res.status(400).json({
        success: false,
        error: 'Total amount is below minimum charge amount (€0.50)'
      });
    }

    // Enriquecer room para obtener el nombre desde PMS
    let enrichedRoom;
    try {
      enrichedRoom = await RoomEnrichmentService.enrichRoom(room);
    } catch (error: any) {
      console.warn('Warning: Could not enrich room with PMS data:', error.message);
      // Continuar sin enriquecimiento si falla
      enrichedRoom = { name: `Room ${room.id}` } as any;
    }

    // Crear Payment Intent con metadata de fees
    const paymentIntent = await stripeService.createMarketplacePaymentIntent({
      propertyId: parseInt(propertyId),
      roomId: parseInt(roomId),
      roomName: enrichedRoom.name,
      guestName,
      guestEmail,
      guestPhone,
      checkIn: checkInDate,
      checkOut: checkOutDate,
      totalAmount,
      nights,
      pricePerNight,
      platformFeePercentage,
      platformFeeAmount,
      subtotal
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount,
        subtotal: subtotal,
        platformFeeAmount: platformFeeAmount,
        platformFeePercentage: platformFeePercentage,
        isTestPrice // Informar al frontend si es precio de prueba
      }
    });

  } catch (error: any) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/public/bookings/confirm-payment
 * @desc    Confirm booking after successful payment
 * @access  Public
 */
router.post('/bookings/confirm-payment', async (req: Request, res: Response) => {
  try {
    const { payment_intent_id, useHybridPayment, creditsUsed } = req.body;

    console.log('confirm-payment received:', { payment_intent_id, useHybridPayment, creditsUsed });

    if (!payment_intent_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment_intent_id'
      });
    }

    // Confirmar pago y crear booking
    const { booking, user } = await stripeService.confirmBookingPayment(payment_intent_id);
    
    console.log('Booking created:', { bookingId: booking?.id, userId: user?.id });
    
    // Si es pago híbrido, descontar los créditos (en transacción separada)
    if (useHybridPayment && creditsUsed && user) {
      console.log('Processing hybrid payment credits:', { userId: user.id, creditsUsed });
      
      const creditTransaction = await sequelize.transaction();
      
      try {
        const userId = user.id;
        
        // Obtener wallet
        const wallet = await UserCreditWallet.getOrCreateWallet(userId);
        
        console.log('Current wallet balance:', wallet.total_balance);
        
        if (wallet.total_balance < creditsUsed) {
          await creditTransaction.rollback();
          console.error('Insufficient credits:', { required: creditsUsed, available: wallet.total_balance });
          // No fallar la reserva, solo loguear el error
          // La reserva ya se hizo con tarjeta
        } else {
          // Crear transacción de créditos
          await CreditTransaction.create({
            user_id: userId,
            transaction_type: 'SPEND',
            amount: -creditsUsed,
            balance_after: wallet.total_balance - creditsUsed,
            status: 'ACTIVE',
            booking_id: booking.id,
            description: `Hybrid payment - ${creditsUsed} credits + card`,
            metadata: JSON.stringify({
              hybrid_payment: true,
              credits_used: creditsUsed,
              card_amount: booking.total_amount
            })
          }, { transaction: creditTransaction });
          
          // Actualizar wallet
          wallet.total_balance -= creditsUsed;
          wallet.total_spent += creditsUsed;
          wallet.last_transaction_at = new Date();
          await wallet.save({ transaction: creditTransaction });
          
          // Actualizar booking metadata para indicar pago híbrido
          if (booking.raw) {
            const rawData = typeof booking.raw === 'string' ? JSON.parse(booking.raw) : booking.raw;
            rawData.payment_type = 'HYBRID';
            rawData.credits_used = creditsUsed;
            rawData.card_amount = booking.total_amount;
            booking.raw = JSON.stringify(rawData);
            await booking.save({ transaction: creditTransaction });
          }
          
          await creditTransaction.commit();
          console.log('Credits deducted successfully:', { newBalance: wallet.total_balance });
        }
      } catch (error) {
        await creditTransaction.rollback();
        console.error('Error processing credits in hybrid payment:', error);
        // No fallar la respuesta, la reserva ya está hecha
      }
    }

    let token = null;
    
    // Si el usuario fue convertido de guest a owner, generar nuevo token
    if (user) {
      const userRole = (user as any).Role?.name || user.role || 'owner';
      token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: userRole,
          status: user.status,
          property_id: user.property_id || null
        },
        process.env.JWT_SECRET!,
        { expiresIn: '24h' }
      );
    }

    const bookingData = booking ? booking.toJSON() : booking;
    
    // Construir la respuesta con el token si está disponible
    const responseData = {
      success: true,
      data: bookingData,
      token
    };

    res.json(responseData);

  } catch (error: any) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/public/bookings/confirm-payment-with-saved-card
 * @desc    Confirm payment with saved payment method and create booking
 * @access  Private (requires authentication)
 */
router.post('/bookings/confirm-payment-with-saved-card', authenticateToken, async (req: Request, res: Response) => {
  try {
    const { payment_intent_id, payment_method_id } = req.body;

    if (!payment_intent_id || !payment_method_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment_intent_id or payment_method_id'
      });
    }

    // Confirmar pago con método guardado
    const paymentIntent = await stripeService.confirmPaymentWithSavedMethod(
      payment_intent_id,
      payment_method_id
    );

    // Si el pago requiere autenticación adicional (3D Secure)
    if (paymentIntent.status === 'requires_action') {
      return res.json({
        success: true,
        requiresAction: true,
        clientSecret: paymentIntent.client_secret
      });
    }

    // Si el pago fue exitoso, crear el booking
    if (paymentIntent.status === 'succeeded') {
      const { booking, user } = await stripeService.confirmBookingPayment(payment_intent_id);

      let token = null;
      
      // Si el usuario fue convertido de guest a owner, generar nuevo token
      if (user) {
        const userRole = (user as any).Role?.name || user.role || 'owner';
        token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: userRole,
            status: user.status,
            property_id: user.property_id || null
          },
          process.env.JWT_SECRET!,
          { expiresIn: '24h' }
        );
      }

      return res.json({
        success: true,
        data: booking,
        token // Retornar el nuevo token si está disponible
      });
    }

    // Otros estados
    res.json({
      success: false,
      error: `Payment status: ${paymentIntent.status}`,
      status: paymentIntent.status
    });

  } catch (error: any) {
    console.error('Error confirming payment with saved card:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * @route   POST /api/public/properties/:propertyId/rooms/:roomId/calculate-credit-cost
 * @desc    Calculate credit cost for a booking WITHOUT creating it (for UI preview)
 * @access  Authenticated (owner role)
 */
router.post('/properties/:propertyId/rooms/:roomId/calculate-credit-cost', authenticateToken, async (req: any, res: Response) => {
  try {
    const { propertyId, roomId } = req.params;
    const { checkIn, checkOut } = req.body;

    if (!checkIn || !checkOut) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: checkIn, checkOut'
      });
    }

    // Validar property
    const property = await Property.findByPk(propertyId);
    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Validar room
    // Note: propertyId field doesn't exist in current schema
    const room = await Room.findOne({
      where: {
        id: roomId
      }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found'
      });
    }

    // Calcular fechas y noches
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Invalid date range'
      });
    }

    // Obtener pricing en EUR (para referencia)
    const basePrice = 100; // customPrice field doesn't exist in current schema - using default
    const guestPrice = await pricingService.calculateGuestPrice(basePrice);
    const totalAmountEUR = guestPrice * nights;

    // Enriquecer room para obtener el tipo desde PMS
    let enrichedRoom;
    try {
      enrichedRoom = await RoomEnrichmentService.enrichRoom(room);
    } catch (error: any) {
      console.warn('Warning: Could not enrich room with PMS data:', error.message);
      enrichedRoom = { name: `Room ${room.id}`, type: 'STANDARD' } as any;
    }

    // Determinar temporada (season) basado en la fecha de check-in
    const seasonType = await SeasonalCalendar.getSeasonForDateWithDefault(parseInt(propertyId), checkInDate);

    // Normalizar room type del PMS a los tipos estándar del sistema
    const normalizeRoomType = (roomType: string): string => {
      const type = roomType.toUpperCase();
      if (type.includes('SUITE') || type.includes('PRESIDENTIAL')) return 'SUITE';
      if (type.includes('DELUXE') || type.includes('JUNIOR')) return 'DELUXE';
      if (type.includes('SUPERIOR') || type.includes('COMFORT')) return 'SUPERIOR';
      return 'STANDARD';
    };

    const roomType = normalizeRoomType(enrichedRoom.type || 'STANDARD');

    // Calcular créditos requeridos usando el Master Formula
    const creditCalculation = await CreditCalculationService.calculateBookingCost(
      parseInt(propertyId),
      roomType,
      seasonType,
      nights,
      checkInDate
    );

    // Obtener balance del usuario
    const wallet = await UserCreditWallet.getOrCreateWallet(req.user.id);

    res.json({
      success: true,
      data: {
        creditsRequired: creditCalculation.totalCredits,
        creditsPerNight: creditCalculation.creditsPerNight,
        totalAmountEUR,
        pricePerNightEUR: guestPrice,
        nights,
        season: seasonType,
        roomType,
        breakdown: creditCalculation.breakdown,
        wallet: {
          availableCredits: wallet.total_balance,
          hasEnoughCredits: wallet.total_balance >= creditCalculation.totalCredits,
          deficit: Math.max(0, creditCalculation.totalCredits - wallet.total_balance)
        }
      }
    });

  } catch (error: any) {
    console.error('Error calculating credit cost:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to calculate credit cost',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/credit-to-eur-rate
 * @desc    Get the current credit to EUR conversion rate
 * @access  Public
 */
router.get('/credit-to-eur-rate', async (req: Request, res: Response) => {
  try {
    const rate = await CreditCalculationServiceClass.getCreditToEurRate();
    console.log('🔍 GET /credit-to-eur-rate returning:', rate, typeof rate);
    res.json({
      success: true,
      data: {
        rate,
        description: 'EUR value per credit for hybrid payment calculations'
      }
    });
  } catch (error) {
    console.error('Error fetching credit to EUR rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch credit to EUR rate'
    });
  }
});

/**
 * @route   POST /api/public/properties/:propertyId/rooms/:roomId/book-with-credits
 * @desc    Create booking paid with credits (auto-approved)
 * @access  Authenticated (owner role)
 */
router.post('/properties/:propertyId/rooms/:roomId/book-with-credits', authenticateToken, async (req: any, res: Response) => {
  const transaction = await sequelize.transaction();
  
  try {
    const { propertyId, roomId } = req.params;
    const { guestName, guestEmail, guestPhone, checkIn, checkOut, guests } = req.body;
    const userId = req.user.id;

    // Validar campos requeridos
    if (!guestName || !guestEmail || !checkIn || !checkOut) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Missing required fields'
      });
    }

    // Validar property
    const property = await Property.findByPk(propertyId);
    if (!property) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Property not found'
      });
    }

    // Validar room
    // Note: propertyId field doesn't exist in current schema
    const room = await Room.findOne({
      where: {
        id: roomId
      }
    });

    if (!room) {
      await transaction.rollback();
      return res.status(404).json({
        success: false,
        error: 'Room not found or not available'
      });
    }

    // Calcular fechas y noches
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60 * 24));

    if (nights <= 0) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Invalid date range'
      });
    }

    // Obtener pricing en EUR (para referencia)
    const basePrice = 100; // customPrice field doesn't exist in current schema - using default
    const guestPrice = await pricingService.calculateGuestPrice(basePrice);
    const totalAmountEUR = guestPrice * nights;

    // Enriquecer room para obtener el nombre y tipo desde PMS
    let enrichedRoom;
    try {
      enrichedRoom = await RoomEnrichmentService.enrichRoom(room);
    } catch (error: any) {
      console.warn('Warning: Could not enrich room with PMS data:', error.message);
      enrichedRoom = { name: `Room ${room.id}`, type: 'STANDARD' } as any;
    }

    // Determinar temporada (season) basado en la fecha de check-in
    const seasonType = await SeasonalCalendar.getSeasonForDateWithDefault(parseInt(propertyId), checkInDate);

    // Normalizar room type del PMS a los tipos estándar del sistema
    const normalizeRoomType = (roomType: string): string => {
      const type = roomType.toUpperCase();
      if (type.includes('SUITE') || type.includes('PRESIDENTIAL')) return 'SUITE';
      if (type.includes('DELUXE') || type.includes('JUNIOR')) return 'DELUXE';
      if (type.includes('SUPERIOR') || type.includes('COMFORT')) return 'SUPERIOR';
      return 'STANDARD';
    };

    const roomType = normalizeRoomType(enrichedRoom.type || 'STANDARD');

    // Calcular créditos requeridos usando el Master Formula
    const creditCalculation = await CreditCalculationService.calculateBookingCost(
      parseInt(propertyId),
      roomType,
      seasonType,
      nights,
      checkInDate
    );

    const creditsRequired = creditCalculation.totalCredits;

    console.log('Credit Calculation:', {
      propertyId,
      roomType,
      seasonType,
      nights,
      creditsPerNight: creditCalculation.creditsPerNight,
      totalCredits: creditsRequired,
      breakdown: creditCalculation.breakdown
    });

    // Verificar balance de créditos del usuario
    const wallet = await UserCreditWallet.getOrCreateWallet(userId);
    
    if (wallet.total_balance < creditsRequired) {
      await transaction.rollback();
      return res.status(400).json({
        success: false,
        error: 'Insufficient credits',
        data: {
          required: creditsRequired,
          available: wallet.total_balance,
          deficit: creditsRequired - wallet.total_balance
        }
      });
    }

    // Crear booking confirmado automáticamente (igual que los bookings con tarjeta)
    const guestToken = `gt_credits_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
    
    const booking = await Booking.create({
      property_id: parseInt(propertyId),
      room_id: parseInt(roomId),
      room_type: enrichedRoom.type || roomType || 'Standard', // Usar tipo del PMS enrichment, no el nombre
      guest_name: guestName,
      guest_email: guestEmail,
      guest_phone: guestPhone || null,
      check_in: checkInDate,
      check_out: checkOutDate,
      status: 'confirmed', // Aprobado automáticamente
      payment_status: 'paid',
      payment_method: 'CREDITS',
      total_amount: totalAmountEUR,
      guest_token: guestToken,
      raw: JSON.stringify({
        nights,
        price_per_night_eur: guestPrice,
        total_amount_eur: totalAmountEUR,
        booking_type: 'marketplace_credits',
        credits_required: creditsRequired,
        credits_per_night: creditCalculation.creditsPerNight,
        season_type: seasonType,
        room_type_category: roomType,
        calculation_breakdown: creditCalculation.breakdown,
        room_name: enrichedRoom.name,
        property_name: property.name,
        auto_approved: true
      })
    }, { transaction });

    // Gastar créditos inmediatamente (transacción completada)
    const creditTransaction = await CreditTransaction.create({
      user_id: userId,
      transaction_type: 'SPEND',
      amount: -creditsRequired,
      balance_after: wallet.total_balance - creditsRequired,
      status: 'ACTIVE',
      booking_id: booking.id,
      description: `Marketplace booking - ${property.name}`,
      metadata: JSON.stringify({
        property_id: propertyId,
        room_id: roomId,
        nights,
        auto_approved: true
      })
    }, { transaction });

    // Actualizar wallet (gastar créditos inmediatamente)
    wallet.total_balance -= creditsRequired;
    wallet.total_spent += creditsRequired;
    wallet.last_transaction_at = new Date();
    await wallet.save({ transaction });

    await transaction.commit();

    res.status(201).json({
      success: true,
      data: {
        booking: {
          id: booking.id,
          status: booking.status,
          payment_status: booking.payment_status,
          check_in: booking.check_in,
          check_out: booking.check_out,
          total_amount: booking.total_amount,
          credits_used: creditsRequired,
          room: {
            name: enrichedRoom.name
          },
          property: {
            name: property.name
          }
        },
        message: 'Booking confirmed successfully',
        confirmed: true
      }
    });

  } catch (error: any) {
    await transaction.rollback();
    console.error('Error creating booking with credits:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create booking',
      message: error.message
    });
  }
});

/**
 * @route   GET /api/public/properties/list/all
 * @desc    Get simple list of all active properties for registration form
 * @access  Public (no authentication required)
 */
router.get('/properties/list/all', async (req: Request, res: Response) => {
  try {
    const { TimeshareProperty } = await import('../models/v2');
    
    const properties = await TimeshareProperty.findAll({
      where: { is_active: true },
      attributes: ['id', 'name', 'city', 'country', 'region'],
      order: [['name', 'ASC']]
    });

    res.json({
      success: true,
      data: properties
    });
  } catch (error: any) {
    console.error('Error fetching properties list:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch properties list',
      message: error.message
    });
  }
});

export default router;

