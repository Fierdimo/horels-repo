import { Router, Request, Response } from 'express';
import { Property, Week, User, Room, Booking, Role } from '../models';
import { Op } from 'sequelize';
import { authenticateToken } from '../middleware/authMiddleware';
import { PMSFactory } from '../services/pms/PMSFactory';
import { decryptPMSCredentials } from '../utils/pmsEncryption';
import pricingService from '../services/pricingService';
import bookingStatusService from '../services/bookingStatusService';
import { StripeService } from '../services/stripeService';
import RoomEnrichmentService from '../services/roomEnrichmentService';
import jwt from 'jsonwebtoken';

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
      status: 'active' // Solo activas
    };

    // Filtros opcionales
    if (city) where.city = city;
    if (country) where.country = country;
    if (stars) where.stars = parseInt(stars as string);
    if (search) {
      where[Op.or] = [
        { name: { [Op.like]: `%${search}%` } },
        { city: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
        { marketplace_description: { [Op.like]: `%${search}%` } }
      ];
    }

    const properties = await Property.findAll({
      where,
      attributes: [
        'id', 'name', 'location', 'city', 'country', 'stars',
        'check_in_time', 'check_out_time', 'timezone', 'languages',
        'pms_provider', // Indica si tiene disponibilidad en tiempo real
        // Use marketplace fields if available, fallback to regular fields
        [Property.sequelize!.fn('COALESCE', 
          Property.sequelize!.col('marketplace_description'), 
          Property.sequelize!.col('description')
        ), 'description'],
        [Property.sequelize!.fn('COALESCE', 
          Property.sequelize!.col('marketplace_images'), 
          Property.sequelize!.col('images')
        ), 'images'],
        [Property.sequelize!.fn('COALESCE', 
          Property.sequelize!.col('marketplace_amenities'), 
          Property.sequelize!.col('amenities')
        ), 'amenities'],
      ],
      order: [['stars', 'DESC'], ['name', 'ASC']]
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
        status: 'active'
      },
      attributes: {
        exclude: ['pms_credentials', 'bank_account_info', 'stripe_connect_account_id'], // No exponer datos sensibles
        include: [
          [Property.sequelize!.fn('COALESCE', 
            Property.sequelize!.col('marketplace_description'), 
            Property.sequelize!.col('description')
          ), 'description'],
          [Property.sequelize!.fn('COALESCE', 
            Property.sequelize!.col('marketplace_images'), 
            Property.sequelize!.col('images')
          ), 'images'],
          [Property.sequelize!.fn('COALESCE', 
            Property.sequelize!.col('marketplace_amenities'), 
            Property.sequelize!.col('amenities')
          ), 'amenities'],
        ]
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
      where: { id, status: 'active' }
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
    if (property.pms_provider && property.pms_provider !== 'none' && property.pms_credentials) {
      try {
        const credentials = decryptPMSCredentials(property.pms_credentials);
        const adapter = PMSFactory.createAdapter(property.pms_provider, credentials);

        // Calcular número de noches
        const nights = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

        // Consultar disponibilidad en PMS
        const pmsAvailability = await adapter.getAvailability({
          propertyId: property.id,
          startDate: start_date as string,
          endDate: end_date as string,
          nights
        });

        // PMS adapters retornan diferentes estructuras
        // Verificar si hay recursos/servicios disponibles
        const hasAvailability = pmsAvailability.resources?.length > 0 || 
                               pmsAvailability.services?.length > 0 ||
                               pmsAvailability.available === true;

        return res.json({
          success: true,
          data: {
            available: hasAvailability,
            source: 'pms',
            pms_provider: property.pms_provider,
            details: pmsAvailability
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
      status: 'active'
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
      where: { id, status: 'active' }
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
          pmsResourceId: room.pmsResourceId,
          name: room.name,
          type: room.type,
          capacity: room.capacity,
          floor: room.floor,
          description: room.description,
          amenities: room.amenities,
          images: room.images,
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
 * @route   GET /api/public/properties/:propertyId/rooms/:roomId
 * @desc    Get room details
 * @access  Public
 */
router.get('/properties/:propertyId/rooms/:roomId', async (req: Request, res: Response) => {
  try {
    const { propertyId, roomId } = req.params;

    const room = await Room.findOne({
      where: {
        id: roomId,
        propertyId,
        isMarketplaceEnabled: true
      }
    });

    if (!room) {
      return res.status(404).json({
        success: false,
        error: 'Room not found or not available'
      });
    }

    // Agregar precio con comisión de plataforma
    const hotelPrice = room.customPrice || 0;
    const guestPrice = await pricingService.calculateGuestPrice(hotelPrice);
    const priceBreakdown = await pricingService.getPriceBreakdown(hotelPrice);

    const roomData = {
      ...room.toJSON(),
      pricing: {
        guestPrice, // Precio final que pagará el guest
        breakdown: priceBreakdown // Desglose completo (opcional, puede ocultarse)
      }
    };

    res.json({
      success: true,
      data: roomData
    });
  } catch (error: any) {
    console.error('Error fetching room details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch room',
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
      where: { status: 'active' },
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
      where: { id: propertyId, status: 'active' }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Verificar que la habitación exista y esté habilitada en marketplace
    const room = await Room.findOne({
      where: {
        id: roomId,
        propertyId: property.id,
        isMarketplaceEnabled: true
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
    const hotelPrice = room.customPrice || 0;
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
      room_type: room.roomTypeId,
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
          type: room.roomTypeId
        },
        property: {
          name: property.name,
          location: property.location
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
      where: { id: propertyId, status: 'active', is_marketplace_enabled: true }
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        error: 'Property not found or not available'
      });
    }

    // Verificar room
    const room = await Room.findOne({
      where: { 
        id: roomId, 
        propertyId: propertyId,
        isMarketplaceEnabled: true
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
    let pricePerNight = room.customPrice || 0;
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

    const totalAmount = pricePerNight * nights;

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

    // Crear Payment Intent
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
      pricePerNight
    });

    res.json({
      success: true,
      data: {
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount: totalAmount,
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
    const { payment_intent_id } = req.body;

    if (!payment_intent_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing payment_intent_id'
      });
    }

    // Confirmar pago y crear booking
    const { booking, user } = await stripeService.confirmBookingPayment(payment_intent_id);

    let token = null;
    
    // Si el usuario fue convertido de guest a owner, generar nuevo token
    if (user) {
      const userRole = (user as any).Role?.name || 'owner';
      token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: userRole,
          status: user.status,
          property_id: user.property_id
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
        const userRole = (user as any).Role?.name || 'owner';
        token = jwt.sign(
          {
            id: user.id,
            email: user.email,
            role: userRole,
            status: user.status,
            property_id: user.property_id
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

export default router;

